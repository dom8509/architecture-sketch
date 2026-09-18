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
  /** Container for the text editor. */
  editor: HTMLElement;
  /** Container for the live preview. */
  preview: HTMLElement;
  /** Optional container for the diagnostics bar. */
  diagnostics?: HTMLElement;
  source?: string;
  /** Overrides the theme of the source without modifying it. */
  theme?: string;
  /** Renders only this view of the source (`view <id>`). */
  view?: string;
  /** Delay between keystroke and recomputation (default 150 ms). */
  debounce?: number;
  /** Additional CodeMirror extensions, e.g. a dark editor theme. */
  extensions?: Extension[];
}

type Listener = (analysis: Analysis) => void;

/** Editor with live preview and diagnostics — framework-free, only DOM and CodeMirror 6. */
export class SysarchEditor {
  readonly view: EditorView;
  readonly preview: Preview;
  private analysis: Analysis;
  private theme: string | undefined;
  private viewId: string | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readonly listeners: Listener[] = [];
  private readonly diagnosticsElement: HTMLElement | undefined;
  private lastSvg: string | undefined;

  constructor(options: EditorOptions) {
    this.theme = options.theme;
    this.viewId = options.view;
    this.diagnosticsElement = options.diagnostics;
    this.analysis = analyze(options.source ?? "", this.theme, this.viewId);
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

  /** Last analysis; `svg` is the most recently rendered SVG, as long as the source is error-free. */
  get current(): Analysis {
    return this.analysis;
  }

  /** The SVG on screen — on errors the last valid state. */
  get svg(): string | undefined {
    return this.lastSvg;
  }

  get source(): string {
    return this.view.state.doc.toString();
  }

  /** Replaces the whole source (as a single undo step) and renders immediately. */
  setSource(source: string) {
    this.view.dispatch({ changes: { from: 0, to: this.view.state.doc.length, insert: source } });
    this.refresh();
  }

  setTheme(theme: string | undefined) {
    this.theme = theme;
    this.refresh();
  }

  /** Renders a single view; `undefined` shows the whole architecture again. */
  setView(view: string | undefined) {
    this.viewId = view;
    this.refresh();
  }

  onUpdate(listener: Listener) {
    this.listeners.push(listener);
  }

  /** Selects a source range and focuses the editor. */
  reveal(start: number, end = start) {
    this.view.dispatch({ selection: { anchor: start, head: end }, scrollIntoView: true });
    this.view.focus();
  }

  destroy() {
    clearTimeout(this.timer);
    this.view.destroy();
    this.preview.destroy();
  }

  /** Recompute without debounce. */
  refresh() {
    clearTimeout(this.timer);
    this.analysis = analyze(this.source, this.theme, this.viewId);
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

/** Diagnostics bar; infos (I…) only show on request, as in the CLI. */
function renderDiagnostics(element: HTMLElement, diagnostics: readonly Diagnostic[], editor: SysarchEditor) {
  const showInfos = element.dataset.showInfos === "true";
  element.replaceChildren();
  element.classList.add("sa-diagnostics");
  const counts = { error: 0, warning: 0, info: 0 };
  for (const d of diagnostics) counts[d.severity]++;

  const summary = element.appendChild(document.createElement("div"));
  summary.className = "sa-diagnostics-summary";
  summary.append(`${counts.error} errors · ${counts.warning} warnings · `);
  const toggle = summary.appendChild(document.createElement("label"));
  const checkbox = toggle.appendChild(document.createElement("input"));
  checkbox.type = "checkbox";
  checkbox.checked = showInfos;
  checkbox.addEventListener("change", () => {
    element.dataset.showInfos = String(checkbox.checked);
    renderDiagnostics(element, diagnostics, editor);
  });
  toggle.append(` ${counts.info} infos`);

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
