import { Compartment } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { SplitPane, SysarchEditor, ViewSelect } from "@sysarch/editor";
import type { EventRef } from "obsidian";
import type { Diagram } from "./exports.js";
import { effectiveTheme } from "./logic.js";
import type SysarchPlugin from "./main.js";

export const isDark = () => document.body.classList.contains("theme-dark");

/**
 * Editor, live preview and diagnostics as in the web app — for `.arch` files and the editor
 * modal. Follows the Obsidian mode as long as the source does not set a `theme`.
 */
export class Workbench {
  readonly editor: SysarchEditor;
  readonly split: SplitPane;
  private readonly appearance = new Compartment();
  private readonly viewSelect: ViewSelect;
  private theme: string | undefined;
  private readonly cssChange: EventRef;
  private saveTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly plugin: SysarchPlugin, parent: HTMLElement, source: string) {
    parent.addClass("sysarch-workbench");
    const editor = parent.createDiv({ cls: "sysarch-editor-pane" });
    const splitter = parent.createDiv({ cls: "sysarch-splitter" });
    const preview = parent.createDiv({ cls: "sysarch-preview-pane" });
    const diagnostics = parent.createDiv({ cls: "sysarch-diagnostics-pane" });
    this.theme = effectiveTheme(source, plugin.settings.theme, isDark());
    this.editor = new SysarchEditor({
      editor, preview, diagnostics, source, theme: this.theme,
      extensions: [this.appearance.of(EditorView.theme({}, { dark: isDark() }))],
    });
    this.split = new SplitPane({
      container: parent,
      splitter,
      state: { width: plugin.settings.editorWidth, collapsed: plugin.settings.editorCollapsed },
      onChange: (state) => {
        plugin.settings.editorWidth = state.width;
        plugin.settings.editorCollapsed = state.collapsed;
        clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => void plugin.savePaneState(), 300);
      },
    });
    this.viewSelect = new ViewSelect(preview.createDiv({ cls: "sysarch-view-bar" }), (view) => this.editor.setView(view));
    this.viewSelect.sync(this.editor.current.model.views);
    this.editor.onUpdate(({ source, model }) => {
      this.syncTheme(source);
      this.viewSelect.sync(model.views);
    });
    this.cssChange = plugin.app.workspace.on("css-change", () => this.refresh());
  }

  /** Shows or hides the editor pane; without an argument it switches. */
  toggleEditor(collapsed?: boolean) {
    this.split.toggle(collapsed);
  }

  /** After a mode switch or changed settings. */
  refresh() {
    this.editor.view.dispatch({ effects: this.appearance.reconfigure(EditorView.theme({}, { dark: isDark() })) });
    this.syncTheme(this.editor.source);
  }

  /** The current state to export; `undefined` while the source contains errors. */
  diagram(sourcePath: string): Diagram | undefined {
    const { rendered, svg, view } = this.editor.current;
    return svg === undefined ? undefined : { model: rendered, svg, theme: this.theme, ...(view && { view }), sourcePath };
  }

  destroy() {
    clearTimeout(this.saveTimer);
    this.plugin.app.workspace.offref(this.cssChange);
    this.split.destroy();
    this.editor.destroy();
  }

  private syncTheme(source: string) {
    const theme = effectiveTheme(source, this.plugin.settings.theme, isDark());
    if (theme === this.theme) return;
    this.theme = theme;
    this.editor.setTheme(theme);
  }
}
