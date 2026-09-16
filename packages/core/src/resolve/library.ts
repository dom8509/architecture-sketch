import type { DefineNode } from "../ast/index.js";
import { diagnostic, withSuggestion, type Diagnostic, type ParseResult } from "../diagnostics/index.js";
import { parse } from "../parser/index.js";
import { CATEGORIES, SHAPES, isOneOf, type Category, type Shape, type Side, type SignalKind, type Size, type Span } from "../types.js";
import { declarePin, type PinDraft } from "./pins.js";

/** Bereinigtes, einfarbiges Symbol im 24×24-Raster. */
export interface IconDef {
  name: string;
  viewBox: "0 0 24 24";
  /** Nur Pfaddaten; gezeichnet mit currentColor als Strich oder Fläche. */
  elements: { d: string; mode: "stroke" | "fill" }[];
}

export interface TemplatePin {
  name: string;
  kind: SignalKind;
  label?: string;
  side?: Side;
}

/** Aufgelöstes Template: Vererbung ist eingemischt, alle Werte sind geprüft. */
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

/** Lädt eine `.archlib`-Quelle. Diagnosen beziehen sich auf diese Quelle. */
export function loadLibrary(source: string, icons: readonly IconDef[]): ParseResult<Library> {
  const parsed = parse(source);
  const diagnostics = [...parsed.diagnostics];
  const iconMap = new Map(icons.map((icon) => [icon.name, icon]));
  if (parsed.value.architecture) {
    diagnostics.push(diagnostic("E001", "Eine Bibliothek enthält nur `define`s, keine `architecture`", parsed.value.architecture.span));
  }
  const templates = resolveDefines(parsed.value.defines, new Map(), iconMap, diagnostics);
  return { value: { templates, icons: iconMap }, diagnostics };
}

/**
 * Löst `define`s gegen eine Basis (z. B. die Standardbibliothek) auf. Ein `extends` auf den
 * eigenen Namen erweitert das gleichnamige Basis-Template.
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
      diagnostics.push(diagnostic("E101", `Template \`${define.name.name}\` ist doppelt definiert`, define.name.span));
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
      diagnostics.push(diagnostic("E104", `Template \`${name}\` erbt zyklisch von sich selbst`, define.name.span));
      return undefined;
    }
    inProgress.add(name);

    let parent: TemplateDef | undefined;
    if (define.extends) {
      parent = lookup(define.extends.name, name);
      if (parent === undefined && !inProgress.has(define.extends.name)) {
        const candidates = new Set([...raw.keys(), ...base.keys()]);
        candidates.delete(name);
        diagnostics.push(withSuggestion("E104", `Unbekanntes Template \`${define.extends.name}\``, define.extends.name, define.extends.span, candidates));
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
          else diagnostics.push(withSuggestion("E109", `Unbekannte Kategorie \`${stmt.value.name}\``, stmt.value.name, stmt.value.span, CATEGORIES));
          break;
        case "Shape":
          if (isOneOf(SHAPES, stmt.value.name)) def.shape = stmt.value.name;
          else diagnostics.push(withSuggestion("E111", `Unbekannte Form \`${stmt.value.name}\``, stmt.value.name, stmt.value.span, SHAPES));
          break;
        case "Icon":
          if (stmt.value.name === "none") {
            delete def.icon;
          } else if (icons.has(stmt.value.name)) {
            def.icon = stmt.value.name;
          } else {
            delete def.icon;
            diagnostics.push(withSuggestion("E111", `Unbekanntes Icon \`${stmt.value.name}\``, stmt.value.name, stmt.value.span, icons.keys()));
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
