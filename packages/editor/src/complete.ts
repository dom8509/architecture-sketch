import type { CompletionContext, CompletionResult, Completion } from "@codemirror/autocomplete";
import {
  CATEGORIES, DIRECTIONS, IMPORTANCES, LAYOUT_MODES, PIN_DISPLAYS, STACK_MODES, SHAPES, SIGNAL_GROUPS, SIGNAL_KINDS, SIZES, THEMES,
  standardLibrary,
} from "@sysarch/core";
import type { Analysis } from "./document.js";

const values = (items: readonly string[], type: string, detail?: (item: string) => string): Completion[] =>
  items.map((label) => ({ label, type, ...(detail && { detail: detail(label) }) }));

const AFTER_KEYWORD: Record<string, Completion[]> = {
  pin: values(SIGNAL_KINDS, "enum", (k) => SIGNAL_GROUPS[k as keyof typeof SIGNAL_GROUPS]),
  type: values(SIGNAL_KINDS, "enum", (k) => SIGNAL_GROUPS[k as keyof typeof SIGNAL_GROUPS]),
  theme: values(THEMES, "enum"),
  direction: values(DIRECTIONS, "enum"),
  pins: values(PIN_DISPLAYS, "enum"),
  stack: values(STACK_MODES, "enum"),
  mode: values(LAYOUT_MODES, "enum"),
  size: values(SIZES, "enum"),
  importance: values(IMPORTANCES, "enum"),
  category: values(CATEGORIES, "enum"),
  shape: values(SHAPES, "enum"),
};

/**
 * Vervollständigung aus dem Semantic Model der letzten Analyse:
 * Template-Namen nach `:`, Pin-Namen nach `komponente.`, feste Werte nach `pin`, `type`, `theme` usw.
 */
export function sysarchCompletion(current: () => Analysis | undefined) {
  return (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(/[A-Za-z_][A-Za-z0-9_-]*/);
    const from = word ? word.from : context.pos;
    if (!word && !context.explicit && !/[.:\s]$/.test(context.state.sliceDoc(context.pos - 1, context.pos))) return null;
    const line = context.state.doc.lineAt(context.pos);
    const before = context.state.sliceDoc(line.from, from);
    const analysis = current();

    const pinOf = /([A-Za-z_][A-Za-z0-9_]*)\.$/.exec(before);
    if (pinOf) {
      const component = analysis?.model.components.get(pinOf[1]!);
      if (!component) return null;
      return {
        from,
        options: component.pins.map((p) => ({ label: p.name, type: "property", detail: `${p.kind} · ${p.side}` })),
        validFor: /^[A-Za-z0-9_]*$/,
      };
    }

    if (/(?:\bcomponent\s+[A-Za-z_][A-Za-z0-9_]*\s*:|\bextends)\s*$/.test(before)) {
      const options: Completion[] = [...standardLibrary().templates.values()].map((t) => ({
        label: t.name, type: "class", ...(t.category && { detail: t.category }),
      }));
      for (const define of analysis?.tree.defines ?? []) {
        if (!options.some((o) => o.label === define.name.name)) options.push({ label: define.name.name, type: "class", detail: "lokal" });
      }
      return {
        from,
        options,
        validFor: /^[A-Za-z0-9_]*$/,
      };
    }

    const keyword = /\b([a-z]+)\s+$/.exec(before);
    const options = keyword && AFTER_KEYWORD[keyword[1]!];
    if (options) return { from, options, validFor: /^[A-Za-z0-9_-]*$/ };
    return null;
  };
}
