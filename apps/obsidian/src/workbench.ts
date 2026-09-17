import { Compartment } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { SysarchEditor } from "@sysarch/editor";
import type { EventRef } from "obsidian";
import type { Diagram } from "./exports.js";
import { effectiveTheme } from "./logic.js";
import type SysarchPlugin from "./main.js";

export const isDark = () => document.body.classList.contains("theme-dark");

/**
 * Editor, Live-Vorschau und Diagnosen wie in der Web-App — für `.arch`-Dateien und das
 * Editor-Modal. Folgt dem Obsidian-Modus, solange die Quelle kein `theme` setzt.
 */
export class Workbench {
  readonly editor: SysarchEditor;
  private readonly appearance = new Compartment();
  private theme: string | undefined;
  private readonly cssChange: EventRef;

  constructor(private readonly plugin: SysarchPlugin, parent: HTMLElement, source: string) {
    parent.addClass("sysarch-workbench");
    const editor = parent.createDiv({ cls: "sysarch-editor-pane" });
    const preview = parent.createDiv({ cls: "sysarch-preview-pane" });
    const diagnostics = parent.createDiv({ cls: "sysarch-diagnostics-pane" });
    this.theme = effectiveTheme(source, plugin.settings.theme, isDark());
    this.editor = new SysarchEditor({
      editor, preview, diagnostics, source, theme: this.theme,
      extensions: [this.appearance.of(EditorView.theme({}, { dark: isDark() }))],
    });
    this.editor.onUpdate(({ source }) => this.syncTheme(source));
    this.cssChange = plugin.app.workspace.on("css-change", () => this.refresh());
  }

  /** Nach einem Moduswechsel oder geänderten Einstellungen. */
  refresh() {
    this.editor.view.dispatch({ effects: this.appearance.reconfigure(EditorView.theme({}, { dark: isDark() })) });
    this.syncTheme(this.editor.source);
  }

  /** Aktueller Stand zum Exportieren; `undefined`, solange die Quelle Fehler enthält. */
  diagram(sourcePath: string): Diagram | undefined {
    const { model, svg } = this.editor.current;
    return svg === undefined ? undefined : { model, svg, theme: this.theme, sourcePath };
  }

  destroy() {
    this.plugin.app.workspace.offref(this.cssChange);
    this.editor.destroy();
  }

  private syncTheme(source: string) {
    const theme = effectiveTheme(source, this.plugin.settings.theme, isDark());
    if (theme === this.theme) return;
    this.theme = theme;
    this.editor.setTheme(theme);
  }
}
