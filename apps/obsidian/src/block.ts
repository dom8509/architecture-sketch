import { analyze, scopeSvg, ViewSelect } from "@sysarch/editor";
import { MarkdownRenderChild, MarkdownView, Menu, Notice, type MarkdownPostProcessorContext } from "obsidian";
import { EditorModal } from "./editor-modal.js";
import { addExportItems, type Diagram } from "./exports.js";
import { effectiveTheme, replaceBlock } from "./logic.js";
import type SysarchPlugin from "./main.js";
import { isDark } from "./workbench.js";

let instances = 0;

/** A ```sysarch code block: inline SVG, diagnostics below it, context menu with exports. */
export class SysarchBlock extends MarkdownRenderChild {
  private readonly prefix = `sab${++instances}`; // own prefix alongside `Preview` (sa1, sa2, …)
  private theme: string | undefined;
  private rendered = false;
  private diagram: Diagram | undefined;
  private view: string | undefined;
  private viewSelect: ViewSelect | undefined;

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

  /** Re-renders as soon as the theme changes; `force` after the settings or the view changed. */
  render(force = false) {
    const theme = effectiveTheme(this.source, this.plugin.settings.theme, isDark());
    if (this.rendered && !force && theme === this.theme) return;
    this.rendered = true;
    this.theme = theme;

    const { model, rendered, svg, view, diagnostics } = analyze(this.source, theme, this.view);
    this.diagram = svg === undefined
      ? undefined
      : { model: rendered, svg, theme, ...(view && { view }), sourcePath: this.ctx.sourcePath };
    const el = this.containerEl;
    el.empty();
    el.addClass("sysarch-block");
    // A block with views gets a selector; without views nothing changes.
    if (model.views.length > 0) {
      const bar = el.createDiv({ cls: "sysarch-view-bar" });
      this.viewSelect = new ViewSelect(bar, (selected) => {
        if (selected === this.view) return;
        this.view = selected;
        this.render(true);
      });
      this.viewSelect.sync(model.views);
      this.viewSelect.element.value = this.view ?? "";
    }
    if (svg !== undefined) el.createDiv({ cls: "sysarch-diagram" }).innerHTML = scopeSvg(svg, this.prefix);

    // infos (I…) are not shown unasked, as in the CLI
    const shown = diagnostics.filter((d) => d.severity !== "info");
    if (shown.length === 0) return;
    const list = el.createEl("ul", { cls: "sysarch-diagnostics" });
    for (const d of shown) {
      const item = list.createEl("li", { cls: `sa-diagnostic sa-${d.severity}` });
      const button = item.createEl("button", { attr: { type: "button", title: "Go to the position in the code block" } });
      button.createSpan({ cls: "sa-diagnostic-position", text: `${d.span.line}:${d.span.column}` });
      button.createSpan({ cls: "sa-diagnostic-code", text: d.code });
      button.createSpan({ text: d.message });
      button.addEventListener("click", () => this.reveal(d.span.line, d.span.column - 1));
    }
  }

  private menu(event: MouseEvent) {
    event.preventDefault();
    const menu = new Menu();
    menu.addItem((item) => item.setTitle("Edit source").setIcon("code").onClick(() => this.reveal(1, 0)));
    menu.addItem((item) => item.setTitle("Open in editor").setIcon("pencil").onClick(() => this.openEditor()));
    menu.addSeparator();
    addExportItems(menu, this.plugin, () => this.diagram);
    menu.showAtMouseEvent(event);
  }

  /** Jumps to a line of the code block inside the note (1 = first line after the fence). */
  private async reveal(line: number, ch: number) {
    const info = this.ctx.getSectionInfo(this.containerEl);
    const leaf = this.plugin.app.workspace.getLeavesOfType("markdown")
      .find((l) => l.view instanceof MarkdownView && l.view.file?.path === this.ctx.sourcePath);
    if (!info || !leaf) return void new Notice("sysarch: code block not found");
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
        new Notice("sysarch: the code block has changed in the meantime — the source is on the clipboard", 8000);
      }
    }).open();
  }
}
