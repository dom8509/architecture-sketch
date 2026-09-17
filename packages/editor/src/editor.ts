import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { bracketMatching, indentUnit } from "@codemirror/language";
import { lintGutter, lintKeymap, setDiagnostics, type Action, type Diagnostic as LintDiagnostic } from "@codemirror/lint";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { EditorState, type Extension } from "@codemirror/state";
import {
  drawSelection, EditorView, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers,
} from "@codemirror/view";
import { codeActions, type Diagnostic } from "@sysarch/core";
import { sysarchCompletion } from "./complete.js";
import { analyze, type Analysis } from "./document.js";
import { sysarchHighlighting } from "./highlight.js";
import { Preview } from "./preview.js";

export interface EditorOptions {
  /** Container für den Texteditor. */
  editor: HTMLElement;
  /** Container für die Live-Vorschau. */
  preview: HTMLElement;
  /** Optionaler Container für die Diagnosenleiste. */
  diagnostics?: HTMLElement;
  source?: string;
  /** Überschreibt das Theme der Quelle, ohne sie zu ändern. */
  theme?: string;
  /** Verzögerung zwischen Tastendruck und Neuberechnung (Standard 150 ms). */
  debounce?: number;
  /** Zusätzliche CodeMirror-Erweiterungen, z. B. ein dunkles Editor-Theme. */
  extensions?: Extension[];
}

type Listener = (analysis: Analysis) => void;

/** Editor mit Live-Vorschau und Diagnosen — framework-frei, nur DOM und CodeMirror 6. */
export class SysarchEditor {
  readonly view: EditorView;
  readonly preview: Preview;
  private analysis: Analysis;
  private theme: string | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readonly listeners: Listener[] = [];
  private readonly diagnosticsElement: HTMLElement | undefined;
  private lastSvg: string | undefined;

  constructor(options: EditorOptions) {
    this.theme = options.theme;
    this.diagnosticsElement = options.diagnostics;
    this.analysis = analyze(options.source ?? "", this.theme);
    this.preview = new Preview(options.preview);
    const debounce = options.debounce ?? 150;

    this.view = new EditorView({
      parent: options.editor,
      state: EditorState.create({
        doc: options.source ?? "",
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          history(),
          drawSelection(),
          indentUnit.of("    "),
          bracketMatching(),
          closeBrackets(),
          highlightActiveLine(),
          highlightSelectionMatches(),
          autocompletion({ override: [sysarchCompletion(() => this.analysis)] }),
          lintGutter(),
          sysarchHighlighting,
          keymap.of([
            ...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap,
            ...completionKeymap, ...lintKeymap, indentWithTab,
          ]),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged) return;
            clearTimeout(this.timer);
            this.timer = setTimeout(() => this.refresh(), debounce);
          }),
          ...(options.extensions ?? []),
        ],
      }),
    });
    this.publish();
  }

  /** Letzte Analyse; `svg` ist das zuletzt gerenderte SVG, sofern die Quelle fehlerfrei ist. */
  get current(): Analysis {
    return this.analysis;
  }

  /** Das angezeigte SVG — bei Fehlern der letzte gültige Stand. */
  get svg(): string | undefined {
    return this.lastSvg;
  }

  get source(): string {
    return this.view.state.doc.toString();
  }

  /** Ersetzt den gesamten Quelltext (als ein Undo-Schritt) und rendert sofort. */
  setSource(source: string) {
    this.view.dispatch({ changes: { from: 0, to: this.view.state.doc.length, insert: source } });
    this.refresh();
  }

  setTheme(theme: string | undefined) {
    this.theme = theme;
    this.refresh();
  }

  onUpdate(listener: Listener) {
    this.listeners.push(listener);
  }

  /** Setzt die Auswahl auf einen Quellbereich und holt den Editor in den Fokus. */
  reveal(start: number, end = start) {
    this.view.dispatch({ selection: { anchor: start, head: end }, scrollIntoView: true });
    this.view.focus();
  }

  destroy() {
    clearTimeout(this.timer);
    this.view.destroy();
    this.preview.destroy();
  }

  /** Neuberechnung ohne Debounce. */
  refresh() {
    clearTimeout(this.timer);
    this.analysis = analyze(this.source, this.theme);
    this.publish();
  }

  private publish() {
    const analysis = this.analysis;
    if (analysis.svg !== undefined) this.lastSvg = analysis.svg;
    this.preview.show(analysis.svg);
    this.view.dispatch(setDiagnostics(this.view.state, analysis.diagnostics.map((d) => this.toLint(d))));
    if (this.diagnosticsElement) renderDiagnostics(this.diagnosticsElement, analysis.diagnostics, this);
    for (const listener of this.listeners) listener(analysis);
  }

  private toLint(d: Diagnostic): LintDiagnostic {
    const { source, tree, model } = this.analysis;
    const length = this.view.state.doc.length;
    const actions: Action[] = codeActions(source, tree, model, d).map((action) => ({
      name: action.label,
      apply: (view) => {
        view.dispatch({
          changes: action.edits.map((e) => ({ from: e.start, to: e.end, insert: e.newText })),
          userEvent: "input.quickfix",
        });
        this.refresh();
      },
    }));
    return {
      from: Math.min(d.span.start, length),
      to: Math.min(Math.max(d.span.end, d.span.start), length),
      severity: d.severity,
      source: d.code,
      message: d.message,
      actions,
    };
  }
}

/** Diagnosenleiste; Hinweise (I…) erscheinen wie in der CLI nur auf Wunsch. */
function renderDiagnostics(element: HTMLElement, diagnostics: readonly Diagnostic[], editor: SysarchEditor) {
  const showInfos = element.dataset.showInfos === "true";
  element.replaceChildren();
  element.classList.add("sa-diagnostics");
  const counts = { error: 0, warning: 0, info: 0 };
  for (const d of diagnostics) counts[d.severity]++;

  const summary = element.appendChild(document.createElement("div"));
  summary.className = "sa-diagnostics-summary";
  summary.append(`${counts.error} Fehler · ${counts.warning} Warnungen · `);
  const toggle = summary.appendChild(document.createElement("label"));
  const checkbox = toggle.appendChild(document.createElement("input"));
  checkbox.type = "checkbox";
  checkbox.checked = showInfos;
  checkbox.addEventListener("change", () => {
    element.dataset.showInfos = String(checkbox.checked);
    renderDiagnostics(element, diagnostics, editor);
  });
  toggle.append(` ${counts.info} Hinweise`);

  const list = element.appendChild(document.createElement("ul"));
  for (const d of diagnostics) {
    if (d.severity === "info" && !showInfos) continue;
    const item = list.appendChild(document.createElement("li"));
    item.className = `sa-diagnostic sa-${d.severity}`;
    const button = item.appendChild(document.createElement("button"));
    button.type = "button";
    const where = button.appendChild(document.createElement("span"));
    where.className = "sa-diagnostic-position";
    where.textContent = `${d.span.line}:${d.span.column}`;
    const code = button.appendChild(document.createElement("span"));
    code.className = "sa-diagnostic-code";
    code.textContent = d.code;
    button.append(d.message);
    button.addEventListener("click", () => editor.reveal(d.span.start, d.span.end));
  }
}
