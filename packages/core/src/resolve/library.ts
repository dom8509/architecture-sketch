import type { DefineNode } from "../ast/index.js";
import { diagnostic, withSuggestion, type Diagnostic, type ParseResult } from "../diagnostics/index.js";
import { parse } from "../parser/index.js";
import { CATEGORIES, SHAPES, isOneOf, type Category, type Shape, type Side, type SignalKind, type Size, type Span } from "../types.js";
import { declarePin, type PinDraft } from "./pins.js";

/** Cleaned-up, single-colour symbol on a 24×24 grid. */
export interface IconDef {
  name: string;
  viewBox: "0 0 24 24";
  /** Path data only; drawn with currentColor as stroke or fill. */
  elements: { d: string; mode: "stroke" | "fill" }[];
}

export interface TemplatePin {
  name: string;
  kind: SignalKind;
  label?: string;
  side?: Side;
}

/** Resolved template: inheritance is merged in, all values are validated. */
export interface TemplateDef {
  name: string;
  extends?: string;
  label?: string;
  category?: Category;
  size?: Size;
  shape?: Shape;
  icon?: string;
  pins: TemplatePin[];
  origin: Span;
}

export interface Library {
  templates: Map<string, TemplateDef>;
  icons: Map<string, IconDef>;
}

/** Loads an `.archlib` source. Diagnostics refer to that source. */
export function loadLibrary(source: string, icons: readonly IconDef[]): ParseResult<Library> {
  const parsed = parse(source);
  const diagnostics = [...parsed.diagnostics];
  const iconMap = new Map(icons.map((icon) => [icon.name, icon]));
  if (parsed.value.architecture) {
    diagnostics.push(diagnostic("E001", "A library contains only `define`s, no `architecture`", parsed.value.architecture.span));
  }
  const templates = resolveDefines(parsed.value.defines, new Map(), iconMap, diagnostics);
  return { value: { templates, icons: iconMap }, diagnostics };
}

/**
 * Resolves `define`s against a base (e.g. the standard library). An `extends` on its own name
 * extends the base template of the same name.
 */
export function resolveDefines(
  defines: readonly DefineNode[],
  base: ReadonlyMap<string, TemplateDef>,
  icons: ReadonlyMap<string, IconDef>,
  diagnostics: Diagnostic[],
): Map<string, TemplateDef> {
  const raw = new Map<string, DefineNode>();
  for (const define of defines) {
    if (raw.has(define.name.name)) {
      diagnostics.push(diagnostic("E101", `Template \`${define.name.name}\` is defined twice`, define.name.span));
      continue;
    }
    raw.set(define.name.name, define);
  }

  const resolved = new Map<string, TemplateDef>();
  const inProgress = new Set<string>();

  const lookup = (name: string, from: string): TemplateDef | undefined => {
    if (name !== from && raw.has(name)) return flatten(raw.get(name)!);
    return base.get(name);
  };

  const flatten = (define: DefineNode): TemplateDef | undefined => {
    const name = define.name.name;
    const done = resolved.get(name);
    if (done) return done;
    if (inProgress.has(name)) {
      diagnostics.push(diagnostic("E104", `Template \`${name}\` inherits from itself in a cycle`, define.name.span));
      return undefined;
    }
    inProgress.add(name);

    let parent: TemplateDef | undefined;
    if (define.extends) {
      parent = lookup(define.extends.name, name);
      if (parent === undefined && !inProgress.has(define.extends.name)) {
        const candidates = new Set([...raw.keys(), ...base.keys()]);
        candidates.delete(name);
        diagnostics.push(withSuggestion("E104", `Unknown template \`${define.extends.name}\``, define.extends.name, define.extends.span, candidates));
      }
    }

    const def: TemplateDef = {
      ...(parent && {
        ...(parent.label !== undefined && { label: parent.label }),
        ...(parent.category && { category: parent.category }),
        ...(parent.size && { size: parent.size }),
        ...(parent.shape && { shape: parent.shape }),
        ...(parent.icon && { icon: parent.icon }),
      }),
      name,
      ...(define.extends && { extends: define.extends.name }),
      pins: [],
      origin: define.span,
    };
    const pins: PinDraft[] = (parent?.pins ?? []).map((p) => ({ ...p, origin: define.span, declaredHere: false }));

    for (const stmt of define.body) {
      switch (stmt.kind) {
        case "Label":
          def.label = stmt.value.value;
          break;
        case "Size":
          def.size = stmt.value;
          break;
        case "Category":
          if (isOneOf(CATEGORIES, stmt.value.name)) def.category = stmt.value.name;
          else diagnostics.push(withSuggestion("E109", `Unknown category \`${stmt.value.name}\``, stmt.value.name, stmt.value.span, CATEGORIES));
          break;
        case "Shape":
          if (isOneOf(SHAPES, stmt.value.name)) def.shape = stmt.value.name;
          else diagnostics.push(withSuggestion("E111", `Unknown shape \`${stmt.value.name}\``, stmt.value.name, stmt.value.span, SHAPES));
          break;
        case "Icon":
          if (stmt.value.name === "none") {
            delete def.icon;
          } else if (icons.has(stmt.value.name)) {
            def.icon = stmt.value.name;
          } else {
            delete def.icon;
            diagnostics.push(withSuggestion("E111", `Unknown icon \`${stmt.value.name}\``, stmt.value.name, stmt.value.span, icons.keys()));
          }
          break;
        case "Pin":
          declarePin(pins, stmt, undefined, "template", diagnostics);
          break;
        case "SideBlock":
          for (const pin of stmt.pins) declarePin(pins, pin, stmt.side, "template", diagnostics);
          break;
      }
    }

    def.pins = pins.map((p) => ({
      name: p.name,
      kind: p.kind,
      ...(p.label !== undefined && { label: p.label }),
      ...(p.side && { side: p.side }),
    }));
    inProgress.delete(name);
    resolved.set(name, def);
    return def;
  };

  for (const define of raw.values()) flatten(define);
  return resolved;
}
