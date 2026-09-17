import { TextFileView, type Menu, type WorkspaceLeaf } from "obsidian";
import { addExportItems } from "./exports.js";
import type SysarchPlugin from "./main.js";
import { Workbench } from "./workbench.js";

export const ARCH_VIEW = "sysarch-arch";

/** Eigene Ansicht für `.arch`-Dateien: derselbe Editor wie in der Web-App. */
export class ArchView extends TextFileView {
  workbench: Workbench | undefined;

  constructor(leaf: WorkspaceLeaf, private readonly plugin: SysarchPlugin) {
    super(leaf);
  }

  getViewType() {
    return ARCH_VIEW;
  }

  override getDisplayText() {
    return this.file?.basename ?? "sysarch";
  }

  override getIcon() {
    return "network";
  }

  getViewData(): string {
    return this.workbench?.editor.source ?? this.data;
  }

  setViewData(data: string, clear: boolean) {
    this.data = data;
    if (!this.workbench) {
      this.workbench = new Workbench(this.plugin, this.contentEl, data);
      this.workbench.editor.onUpdate(({ source }) => {
        if (source === this.data) return;
        this.data = source;
        this.requestSave();
      });
    } else if (data !== this.workbench.editor.source) {
      this.workbench.editor.setSource(data);
    }
    if (clear) this.workbench.editor.preview.fit();
  }

  clear() {}

  override onPaneMenu(menu: Menu, source: string) {
    super.onPaneMenu(menu, source);
    menu.addSeparator();
    addExportItems(menu, this.plugin, () => (this.file ? this.workbench?.diagram(this.file.path) : undefined));
  }

  override async onClose() {
    this.workbench?.destroy();
    this.workbench = undefined;
    this.contentEl.empty();
  }
}
