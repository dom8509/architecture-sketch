import { ButtonComponent, Modal } from "obsidian";
import type SysarchPlugin from "./main.js";
import { Workbench } from "./workbench.js";

/** Editor mit Vorschau für einen Codeblock; übergibt die Quelle beim Schließen an `onClose`. */
export class EditorModal extends Modal {
  private workbench: Workbench | undefined;
  private discard = false;

  constructor(
    private readonly plugin: SysarchPlugin,
    private readonly source: string,
    private readonly done: (source: string) => void,
  ) {
    super(plugin.app);
  }

  override onOpen() {
    this.modalEl.addClass("sysarch-modal");
    this.titleEl.setText("sysarch");
    this.workbench = new Workbench(this.plugin, this.contentEl.createDiv(), this.source);
    const buttons = this.contentEl.createDiv({ cls: "modal-button-container" });
    new ButtonComponent(buttons).setButtonText("Verwerfen").onClick(() => {
      this.discard = true;
      this.close();
    });
    new ButtonComponent(buttons).setButtonText("Übernehmen").setCta().onClick(() => this.close());
    this.workbench.editor.view.focus();
  }

  override onClose() {
    const source = this.workbench?.editor.source;
    this.workbench?.destroy();
    this.workbench = undefined;
    this.contentEl.empty();
    if (!this.discard && source !== undefined && source !== this.source) this.done(source);
  }
}
