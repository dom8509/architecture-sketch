import { analyze, scopeSvg } from "@sysarch/editor";
import { MarkdownRenderChild, MarkdownView, Menu, Notice, type MarkdownPostProcessorContext } from "obsidian";
import { EditorModal } from "./editor-modal.js";
import { addExportItems, type Diagram } from "./exports.js";
import { effectiveTheme, replaceBlock } from "./logic.js";
import type SysarchPlugin from "./main.js";
import { isDark } from "./workbench.js";

let instances = 0;

/** Ein ```sysarch-Codeblock: inline SVG, Diagnosen darunter, Kontextmenü mit Exporten. */
export class SysarchBlock extends MarkdownRenderChild {
  private readonly prefix = `sab${++instances}`; // eigener Präfix neben `Preview` (sa1, sa2, …)
  private theme: string | undefined;
  private rendered = false;
  private diagram: Diagram | undefined;

  constructor(
    private readonly plugin: SysarchPlugin,
    containerEl: HTMLElement,
    private readonly source: string,
    private readonly ctx: MarkdownPostProcessorContext,
  ) {
    super(containerEl);
  }

  override onload() {
    this.plugin.blocks.add(this);
    this.render();
    this.registerEvent(this.plugin.app.workspace.on("css-change", () => this.render()));
    this.registerDomEvent(this.containerEl, "contextmenu", (event) => this.menu(event));
  }

  override onunload() {
    this.plugin.blocks.delete(this);
  }

  /** Rendert neu, sobald sich das Theme ändert; `force` nach geänderten Einstellungen. */
  render(force = false) {
    const theme = effectiveTheme(this.source, this.plugin.settings.theme, isDark());
    if (this.rendered && !force && theme === this.theme) return;
    this.rendered = true;
    this.theme = theme;

    const { model, svg, diagnostics } = analyze(this.source, theme);
    this.diagram = svg === undefined ? undefined : { model, svg, theme, sourcePath: this.ctx.sourcePath };
    const el = this.containerEl;
    el.empty();
    el.addClass("sysarch-block");
    if (svg !== undefined) el.createDiv({ cls: "sysarch-diagram" }).innerHTML = scopeSvg(svg, this.prefix);

    // Hinweise (I…) wie in der CLI nicht ungefragt
    const shown = diagnostics.filter((d) => d.severity !== "info");
    if (shown.length === 0) return;
    const list = el.createEl("ul", { cls: "sysarch-diagnostics" });
    for (const d of shown) {
      const item = list.createEl("li", { cls: `sa-diagnostic sa-${d.severity}` });
      const button = item.createEl("button", { attr: { type: "button", title: "Zur Stelle im Codeblock" } });
      button.createSpan({ cls: "sa-diagnostic-position", text: `${d.span.line}:${d.span.column}` });
      button.createSpan({ cls: "sa-diagnostic-code", text: d.code });
      button.createSpan({ text: d.message });
      button.addEventListener("click", () => this.reveal(d.span.line, d.span.column - 1));
    }
  }

  private menu(event: MouseEvent) {
    event.preventDefault();
    const menu = new Menu();
    menu.addItem((item) => item.setTitle("Quelle bearbeiten").setIcon("code").onClick(() => this.reveal(1, 0)));
    menu.addItem((item) => item.setTitle("Im Editor öffnen").setIcon("pencil").onClick(() => this.openEditor()));
    menu.addSeparator();
    addExportItems(menu, this.plugin, () => this.diagram);
    menu.showAtMouseEvent(event);
  }

  /** Springt in die Notiz an eine Zeile des Codeblocks (1 = erste Zeile nach dem Zaun). */
  private async reveal(line: number, ch: number) {
    const info = this.ctx.getSectionInfo(this.containerEl);
    const leaf = this.plugin.app.workspace.getLeavesOfType("markdown")
      .find((l) => l.view instanceof MarkdownView && l.view.file?.path === this.ctx.sourcePath);
    if (!info || !leaf) return void new Notice("sysarch: Codeblock nicht gefunden");
    const state = leaf.getViewState();
    if (state.state?.mode === "preview") {
      await leaf.setViewState({ ...state, state: { ...state.state, mode: "source" } });
    }
    this.plugin.app.workspace.setActiveLeaf(leaf, { focus: true });
    const editor = (leaf.view as MarkdownView).editor;
    const position = { line: info.lineStart + line, ch: Math.max(0, ch) };
    editor.setCursor(position);
    editor.scrollIntoView({ from: position, to: position }, true);
    editor.focus();
  }

  private openEditor() {
    new EditorModal(this.plugin, this.source, async (source) => {
      const info = this.ctx.getSectionInfo(this.containerEl);
      const file = this.plugin.app.vault.getFileByPath(this.ctx.sourcePath);
      let written = false;
      if (info && file) {
        await this.plugin.app.vault.process(file, (text) => {
          const replaced = replaceBlock(text, info.lineStart, info.lineEnd, this.source, source);
          written = replaced !== undefined;
          return replaced ?? text;
        });
      }
      if (!written) {
        await navigator.clipboard.writeText(source);
        new Notice("sysarch: Der Codeblock hat sich inzwischen geändert — die Quelle liegt in der Zwischenablage", 8000);
      }
    }).open();
  }
}
