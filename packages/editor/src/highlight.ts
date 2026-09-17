import { RangeSetBuilder } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import {
  CATEGORIES, DIRECTIONS, IMPORTANCES, LAYOUT_MODES, SHAPES, SIDES, SIGNAL_KINDS, SIZES, THEMES, lex,
  type Token,
} from "@sysarch/core";

const KEYWORDS = new Set([
  "architecture", "theme", "direction", "layout", "mode", "grid", "zone", "system", "component",
  "label", "size", "importance", "category", "pin", ...SIDES, "hint", "row", "column", "meta",
  "define", "extends", "shape", "icon", "type",
]);
/** Nach diesen Schlüsselwörtern folgt ein Wert aus einer festen Menge. */
const VALUE_KEYWORDS = new Set(["theme", "direction", "mode", "size", "importance", "category", "pin", "type", "shape", "icon"]);
const VALUES = new Set<string>([
  ...SIGNAL_KINDS, ...SIZES, ...IMPORTANCES, ...DIRECTIONS, ...LAYOUT_MODES, ...SHAPES, ...CATEGORIES, ...THEMES, "none",
]);
const DECLARING = new Set(["component", "zone", "system", "define"]);

export type TokenClass =
  | "keyword" | "value" | "definition" | "template" | "pin" | "string" | "number"
  | "operator" | "punctuation" | "comment" | "invalid";

/** Klassifiziert Token für das Highlighting — kontextabhängig, denn die DSL reserviert keine Wörter. */
export function classify(source: string): { start: number; end: number; class: TokenClass }[] {
  const { tokens } = lex(source);
  const result: { start: number; end: number; class: TokenClass }[] = [];
  tokens.forEach((t, i) => {
    for (const trivia of t.leadingTrivia) {
      if (trivia.kind === "comment") result.push({ start: trivia.span.start, end: trivia.span.end, class: "comment" });
    }
    const cls = tokenClass(t, tokens[i - 1], tokens[i + 1]);
    if (cls) result.push({ start: t.span.start, end: t.span.end, class: cls });
  });
  return result;
}

function tokenClass(t: Token, prev: Token | undefined, next: Token | undefined): TokenClass | undefined {
  switch (t.type) {
    case "string": return "string";
    case "int": return "number";
    case "->": case "<-": case "<->": case "--": return "operator";
    case "invalid": return "invalid";
    case "eof": return undefined;
    case "ident": break;
    default: return "punctuation";
  }
  if (prev?.type === ".") return "pin";
  if (prev?.type === ":" || (prev?.type === "ident" && prev.text === "extends")) return "template";
  if (prev?.type === "ident" && DECLARING.has(prev.text)) return "definition";
  if (prev?.type === "ident" && VALUE_KEYWORDS.has(prev.text) && VALUES.has(t.text)) return "value";
  // Komponentenreferenz am Anfang einer Verbindung (`pin.X -> …`, `size -> …`)
  if (next?.type === "." || next?.type === "->" || next?.type === "<-" || next?.type === "<->" || next?.type === "--") return undefined;
  if (KEYWORDS.has(t.text)) return "keyword";
  return undefined;
}

const marks = new Map<TokenClass, Decoration>();
const mark = (cls: TokenClass) => {
  let m = marks.get(cls);
  if (!m) marks.set(cls, (m = Decoration.mark({ class: `cm-sa-${cls}` })));
  return m;
};

function decorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (const r of classify(view.state.doc.toString())) {
    if (r.end > r.start) builder.add(r.start, r.end, mark(r.class));
  }
  return builder.finish();
}

/** Syntax-Highlighting über den Lexer aus `@sysarch/core` — keine zweite Grammatik. */
export const sysarchHighlighting = [
  ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = decorations(view);
      }
      update(update: ViewUpdate) {
        if (update.docChanged) this.decorations = decorations(update.view);
      }
    },
    { decorations: (plugin) => plugin.decorations },
  ),
  EditorView.baseTheme({
    "&light .cm-sa-keyword": { color: "#7c3aed" },
    "&light .cm-sa-value": { color: "#0e7490" },
    "&light .cm-sa-definition": { color: "#1d4ed8", fontWeight: "600" },
    "&light .cm-sa-template": { color: "#b45309" },
    "&light .cm-sa-pin": { color: "#047857" },
    "&light .cm-sa-string": { color: "#b91c1c" },
    "&light .cm-sa-number": { color: "#c2410c" },
    "&light .cm-sa-operator": { color: "#475569", fontWeight: "600" },
    "&light .cm-sa-punctuation": { color: "#64748b" },
    "&light .cm-sa-comment": { color: "#6b7280", fontStyle: "italic" },
    "&dark .cm-sa-keyword": { color: "#c4b5fd" },
    "&dark .cm-sa-value": { color: "#67e8f9" },
    "&dark .cm-sa-definition": { color: "#93c5fd", fontWeight: "600" },
    "&dark .cm-sa-template": { color: "#fcd34d" },
    "&dark .cm-sa-pin": { color: "#6ee7b7" },
    "&dark .cm-sa-string": { color: "#fca5a5" },
    "&dark .cm-sa-number": { color: "#fdba74" },
    "&dark .cm-sa-operator": { color: "#cbd5e1", fontWeight: "600" },
    "&dark .cm-sa-punctuation": { color: "#94a3b8" },
    "&dark .cm-sa-comment": { color: "#9ca3af", fontStyle: "italic" },
    ".cm-sa-invalid": { textDecoration: "underline wavy #dc2626" },
  }),
];
