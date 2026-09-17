import type {
  ArchitectureNode, CategoryStmt, ComponentNode, ConnectionNode, DefineNode, DirectionStmt, PinsStmt, StackStmt,
  EndpointNode, CountStmt, GridNode, GridRow, HintStmt, IconStmt, ImportanceStmt, LabelStmt, LayoutStmt,
  MetaBlock, MetaEntry, ModeStmt, PinStmt, ShapeStmt, SideBlock, SizeStmt, StringLit, SyntaxNode,
  SyntaxTree, ThemeStmt, Trivia, TypeStmt, ZoneNode,
} from "../ast/index.js";
import { hasErrors, type ParseResult } from "../diagnostics/index.js";
import { lex } from "../lexer/index.js";
import { parse } from "../parser/index.js";

const INDENT = "    ";

/** Knoten, die eine eigene Zeile (bzw. einen eigenen Block) bilden. */
type Statement = Exclude<SyntaxNode, SyntaxTree>;

/** Knotenarten, die innerhalb einer Anweisung stehen und nie eine eigene Zeile bekommen. */
const INLINE_KINDS = new Set(["Document", "Ident", "String", "Endpoint", "GridCell"]);

/** Eigenschaften, mit denen eine Komponente als Einzeiler geschrieben wird. */
const COMPONENT_ONE_LINER_KINDS = new Set(["Label", "Size", "Importance", "Category", "Hint", "Count"]);

/** Seitenblöcke mit höchstens so vielen Pins ohne Label passen auf eine Zeile … */
const MAX_INLINE_PINS = 3;
/** … sofern die Zeile ohne Ausrichtung nicht breiter wird. */
const MAX_WIDTH = 80;

/** Anweisungen, deren Inline-Blöcke untereinander bündig stehen. */
const ALIGNED_KINDS = new Set(["Connection", "SideBlock"]);

/** Reihenfolge der Anweisungen in `architecture` (02-dsl.md §6). */
const ORDER: Readonly<Record<string, number>> = {
  Theme: 0, Direction: 1, Pins: 2, Stack: 3, Layout: 4, Zone: 5, System: 5, Component: 5, Connection: 6,
};

/** Abschnitte in `architecture`, getrennt durch eine Leerzeile. */
const SECTION: Readonly<Record<string, number>> = {
  Theme: 0, Direction: 0, Pins: 0, Stack: 0, Layout: 1, Zone: 2, System: 2, Component: 2, Connection: 3,
};

interface Entry {
  node: Statement;
  /** Kommentare und Leerzeilen auf eigenen Zeilen vor der Anweisung. */
  before: Trivia[];
  /** Kommentare, die im Quelltext hinter der Anweisung auf derselben Zeile stehen. */
  after: Trivia[];
}

/** Einzeilige Form: Kopf und optional ein Inline-Block `{ … }`, dessen `{` ausgerichtet wird. */
interface OneLine {
  head: string;
  body?: string;
}

/**
 * Kanonische Formatierung (02-dsl.md §6). Bei Syntaxfehlern bleibt der Quelltext unverändert;
 * die Diagnosen des Parsers werden zurückgegeben. Kommentare bleiben erhalten.
 */
export function format(source: string): ParseResult<string> {
  const parsed = parse(source);
  if (hasErrors(parsed.diagnostics)) return { value: source, diagnostics: parsed.diagnostics };
  const tree = parsed.value;
  const lines: string[] = [];

  // ── Kommentare innerhalb von Anweisungen ─────────────────────
  // Der Parser hängt Trivia an das Folgetoken. Steht ein Kommentar vor einem Token mitten in
  // einer Anweisung (`pin /* x */ can TX`), taucht er im Syntaxbaum nicht auf. Solche Kommentare
  // wandern vor die innerste Anweisung, die sie umschließt.
  const attached = new Set<number>();
  const statements: Statement[] = [];
  const walk = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (typeof value !== "object" || value === null || !("kind" in value)) return;
    const n = value as SyntaxNode;
    for (const t of [...n.leadingTrivia, ...(n.closingTrivia ?? [])]) attached.add(t.span.start);
    if (!INLINE_KINDS.has(n.kind)) statements.push(n as Statement);
    for (const [key, child] of Object.entries(n)) {
      if (key !== "leadingTrivia" && key !== "closingTrivia" && key !== "span") walk(child);
    }
  };
  walk(tree);

  const sourceComments = lex(source).tokens.flatMap((t) => t.leadingTrivia).filter((t) => t.kind === "comment");
  const hoisted = new Map<SyntaxNode, Trivia[]>();
  const orphans: Trivia[] = [];
  for (const comment of sourceComments) {
    if (attached.has(comment.span.start)) continue;
    let owner: Statement | undefined;
    for (const s of statements) {
      const inside = s.span.start < comment.span.start && comment.span.start < s.span.end;
      if (inside && (!owner || s.span.end - s.span.start < owner.span.end - owner.span.start)) owner = s;
    }
    if (owner) hoisted.set(owner, [...(hoisted.get(owner) ?? []), comment]);
    else orphans.push(comment);
  }

  // ── Trivia ───────────────────────────────────────────────────

  /** Steht der Kommentar auf derselben Zeile wie das vorige Token? */
  const isTrailing = (t: Trivia): boolean => {
    if (t.kind !== "comment") return false;
    let p = t.span.start - 1;
    while (p >= 0 && (source[p] === " " || source[p] === "\t" || source[p] === "\r")) p--;
    return p >= 0 && source[p] !== "\n";
  };

  const splitTrivia = (trivia: readonly Trivia[]): { trailing: Trivia[]; rest: Trivia[] } => {
    let k = 0;
    while (k < trivia.length && isTrailing(trivia[k]!)) k++;
    return { trailing: trivia.slice(0, k), rest: trivia.slice(k) };
  };

  const hasComment = (trivia: readonly Trivia[] | undefined) => trivia?.some((t) => t.kind === "comment") ?? false;

  /** Enthält der Knoten (oder ein Kind) Kommentare? Dann gibt es keine einzeilige Form. */
  const containsComments = (n: SyntaxNode, self = true): boolean => {
    if (self && (hasComment(n.leadingTrivia) || hoisted.has(n))) return true;
    if (hasComment(n.closingTrivia)) return true;
    return Object.entries(n).some(([key, child]) => {
      if (key === "leadingTrivia" || key === "closingTrivia" || key === "span") return false;
      const children = Array.isArray(child) ? child : [child];
      return children.some((c) => typeof c === "object" && c !== null && "kind" in c && containsComments(c as SyntaxNode));
    });
  };

  // ── Ausgabe ──────────────────────────────────────────────────

  const emit = (depth: number, text: string) => lines.push(INDENT.repeat(depth) + text);

  const appendTrailing = (comments: readonly Trivia[]) => {
    if (comments.length === 0) return;
    lines[lines.length - 1] += comments.map((c) => " " + c.text).join("");
  };

  const blankLine = () => {
    if (lines.length > 0 && lines[lines.length - 1] !== "") lines.push("");
  };

  const trimBlankLines = () => {
    while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  };

  /** Kommentare auf eigenen Zeilen; Leerzeilen nur, wenn `allowBlank` (höchstens eine in Folge). */
  const printTrivia = (depth: number, trivia: readonly Trivia[], allowBlank: boolean) => {
    for (const t of trivia) {
      if (t.kind === "blankLine") {
        if (allowBlank) blankLine();
      } else {
        emit(depth, t.text);
        allowBlank = true;
      }
    }
  };

  const str = (s: StringLit) => `"${s.value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;

  /** Ordnet Kommentare einer Anweisungsliste zu: eigene Zeilen davor, gleiche Zeile dahinter. */
  const toEntries = (items: readonly Statement[], closingTrivia: readonly Trivia[] | undefined) => {
    const header: Trivia[] = [];
    const entries: Entry[] = [];
    for (const node of items) {
      const { trailing, rest } = splitTrivia(node.leadingTrivia);
      (entries.length > 0 ? entries[entries.length - 1]!.after : header).push(...trailing);
      entries.push({ node, before: rest, after: [] });
    }
    const closing = splitTrivia(closingTrivia ?? []);
    (entries.length > 0 ? entries[entries.length - 1]!.after : header).push(...closing.trailing);
    return { header, entries, closing: closing.rest };
  };

  const componentHead = (c: ComponentNode) => `component ${c.id.name}${c.template ? ": " + c.template.name : ""}`;
  const endpoint = (e: EndpointNode) => e.component.name + (e.pin ? "." + e.pin.name : "");
  const connectionHead = (c: ConnectionNode) => `${endpoint(c.from)} ${c.arrow} ${endpoint(c.to)}`;

  /** Einzeilige Form einer Anweisung, sofern sie eine hat. */
  const oneLine = (n: Statement, depth: number): OneLine | undefined => {
    const inline = (head: string, body: readonly Statement[] | undefined, fits: boolean, separator = " "): OneLine | undefined => {
      if (containsComments(n, false)) return undefined;
      if (!body || body.length === 0) return { head };
      if (!fits) return undefined;
      return { head, body: `{ ${body.map((s) => oneLine(s, depth + 1)!.head).join(separator)} }` };
    };
    switch (n.kind) {
      case "Theme": return { head: `theme ${(n as ThemeStmt).name.name}` };
      case "Direction": return { head: `direction ${(n as DirectionStmt).value}` };
      case "Pins": return { head: `pins ${(n as PinsStmt).value}` };
      case "Stack": return { head: `stack ${(n as StackStmt).value}` };
      case "Mode": return { head: `mode ${(n as ModeStmt).value}` };
      case "Label": return { head: `label ${str((n as LabelStmt).value)}` };
      case "Size": return { head: `size ${(n as SizeStmt).value}` };
      case "Importance": return { head: `importance ${(n as ImportanceStmt).value}` };
      case "Category": return { head: `category ${(n as CategoryStmt).value.name}` };
      case "Shape": return { head: `shape ${(n as ShapeStmt).value.name}` };
      case "Icon": return { head: `icon ${(n as IconStmt).value.name}` };
      case "Type": return { head: `type ${(n as TypeStmt).value.name}` };
      case "Count": return { head: `count ${(n as CountStmt).value}` };
      case "Hint": {
        const h = n as HintStmt;
        return { head: `hint ${h.axis} ${h.value}` };
      }
      case "MetaEntry": {
        const e = n as MetaEntry;
        return { head: `${e.key.name} ${str(e.value)}` };
      }
      case "Pin": {
        const p = n as PinStmt;
        return { head: `pin ${p.signal.name} ${p.name.name}${p.label ? " " + str(p.label) : ""}` };
      }
      case "SideBlock": {
        const s = n as SideBlock;
        const fits = s.pins.length <= MAX_INLINE_PINS && s.pins.every((p) => !p.label);
        const form = inline(s.side, s.pins, fits, "   ");
        const tooLong = form?.body !== undefined && INDENT.length * depth + form.head.length + form.body.length + 1 > MAX_WIDTH;
        return tooLong ? undefined : form;
      }
      case "Component": {
        const c = n as ComponentNode;
        const fits = c.body?.length === 1 && COMPONENT_ONE_LINER_KINDS.has(c.body[0]!.kind);
        return inline(componentHead(c), c.body, fits);
      }
      case "Connection": {
        const c = n as ConnectionNode;
        return inline(connectionHead(c), c.body, (c.body?.length ?? 0) <= 2);
      }
      default: return undefined;
    }
  };

  /** Kopfzeile und Kinder eines immer mehrzeiligen Blocks. */
  const blockOf = (n: Statement): { head: string; items: Statement[] } | undefined => {
    switch (n.kind) {
      case "Architecture": {
        const a = n as ArchitectureNode;
        return { head: `architecture ${str(a.title)}`, items: a.body };
      }
      case "Define": {
        const d = n as DefineNode;
        return { head: `define ${d.name.name}${d.extends ? " extends " + d.extends.name : ""}`, items: d.body };
      }
      case "Zone": case "System": {
        const g = n as ZoneNode;
        return { head: `${n.kind.toLowerCase()} ${g.id.name}`, items: g.body };
      }
      case "Layout": return { head: "layout", items: (n as LayoutStmt).body };
      case "Meta": return { head: "meta", items: (n as MetaBlock).entries };
      case "SideBlock": return { head: (n as SideBlock).side, items: (n as SideBlock).pins };
      case "Component": return { head: componentHead(n as ComponentNode), items: (n as ComponentNode).body ?? [] };
      case "Connection": return { head: connectionHead(n as ConnectionNode), items: (n as ConnectionNode).body ?? [] };
      default: return undefined;
    }
  };

  const gridRowText = (row: GridRow, widths: readonly number[]) =>
    row.cells.map((c, k) => (c.id?.name ?? ".").padEnd(widths[k] ?? 0)).join(" | ").trimEnd();

  /** Schreibt eine Anweisungsliste. `sectioned`: Abschnittswechsel erzwingen eine Leerzeile. */
  const printEntries = (
    depth: number,
    entries: readonly Entry[],
    options: { sectioned?: boolean; separated?: boolean; grid?: readonly number[] } = {},
  ) => {
    const lineForms = entries.map((e) => (options.grid ? undefined : oneLine(e.node, depth)));

    // Inline-Blöcke aufeinanderfolgender Verbindungen bzw. Seitenblöcke bündig ausrichten.
    const widths = new Array<number>(entries.length).fill(0);
    for (let k = 0; k < entries.length;) {
      const kind = entries[k]!.node.kind;
      if (!ALIGNED_KINDS.has(kind)) {
        k++;
        continue;
      }
      let end = k + 1;
      // Mehrzeilige Anweisungen, Leerzeilen und Kommentare auf eigener Zeile beenden die Gruppe.
      while (end < entries.length && entries[end]!.node.kind === kind && entries[end]!.before.length === 0
        && !hoisted.has(entries[end]!.node) && lineForms[end] && lineForms[end - 1]) end++;
      let width = 0;
      for (let j = k; j < end; j++) {
        const form = lineForms[j];
        if (form?.body !== undefined) width = Math.max(width, form.head.length);
      }
      for (let j = k; j < end; j++) widths[j] = width;
      k = end;
    }

    entries.forEach((entry, k) => {
      const { node } = entry;
      const first = k === 0;
      const sectionChange = options.sectioned && !first && SECTION[node.kind] !== SECTION[entries[k - 1]!.node.kind];
      if (!first && (sectionChange || options.separated)) blankLine();
      printTrivia(depth, entry.before, !first);
      printTrivia(depth, hoisted.get(node) ?? [], true);

      if (options.grid) {
        emit(depth, gridRowText(node as GridRow, options.grid));
      } else if (lineForms[k]) {
        const form = lineForms[k]!;
        emit(depth, form.body === undefined ? form.head : form.head.padEnd(widths[k]!) + " " + form.body);
      } else {
        printBlock(depth, node);
      }
      appendTrailing(entry.after);
    });
  };

  const printBlock = (depth: number, n: Statement) => {
    if (n.kind === "Grid") {
      const grid = n as GridNode;
      const widths: number[] = [];
      for (const row of grid.rows) {
        row.cells.forEach((c, k) => (widths[k] = Math.max(widths[k] ?? 0, (c.id?.name ?? ".").length)));
      }
      const { header, entries, closing } = toEntries(grid.rows, grid.closingTrivia);
      emit(depth, "grid {");
      appendTrailing(header);
      printEntries(depth + 1, entries, { grid: widths });
      printTrivia(depth + 1, closing, true);
      trimBlankLines();
      emit(depth, "}");
      return;
    }
    const block = blockOf(n)!;
    const { header, entries, closing } = toEntries(block.items, n.closingTrivia);
    // Erst nach dem Zuordnen der Kommentare sortieren (stabil), damit sie an ihrer Anweisung bleiben.
    if (n.kind === "Architecture") entries.sort((x, y) => ORDER[x.node.kind]! - ORDER[y.node.kind]!);
    if (entries.length === 0 && header.length === 0 && !hasComment(closing)) {
      emit(depth, block.head + " {}");
      return;
    }
    emit(depth, block.head + " {");
    appendTrailing(header);
    printEntries(depth + 1, entries, { sectioned: n.kind === "Architecture" });
    printTrivia(depth + 1, closing, true);
    trimBlankLines();
    emit(depth, "}");
  };

  // ── Dokument ─────────────────────────────────────────────────

  const top: Statement[] = [...tree.defines, ...(tree.architecture ? [tree.architecture] : [])];
  const { entries, closing } = toEntries(top, tree.closingTrivia);
  printEntries(0, entries, { separated: true });
  printTrivia(0, [...closing, ...orphans], true);
  trimBlankLines();
  const value = lines.length > 0 ? lines.join("\n") + "\n" : "";

  // Schutz vor Datenverlust: jeder Kommentar muss genau einmal in der Ausgabe stehen.
  const commentTexts = (text: string) =>
    lex(text).tokens.flatMap((t) => t.leadingTrivia).filter((t) => t.kind === "comment").map((t) => t.text).sort();
  if (commentTexts(value).join("\0") !== sourceComments.map((t) => t.text).sort().join("\0")) {
    throw new Error("format: Kommentare stimmen nach dem Formatieren nicht überein");
  }
  return { value, diagnostics: parsed.diagnostics };
}
