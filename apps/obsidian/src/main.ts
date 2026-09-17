import { Notice, Plugin, normalizePath, type TFolder } from "obsidian";
import { ArchView, ARCH_VIEW } from "./arch-view.js";
import { SysarchBlock } from "./block.js";
import { NEW_SOURCE } from "./logic.js";
import { DEFAULT_SETTINGS, SysarchSettingTab, type SysarchSettings } from "./settings.js";

export default class SysarchPlugin extends Plugin {
  override settings: SysarchSettings = { ...DEFAULT_SETTINGS };
  readonly blocks = new Set<SysarchBlock>();

  override async onload() {
    await this.loadSettings();
    this.addSettingTab(new SysarchSettingTab(this.app, this));

    this.registerMarkdownCodeBlockProcessor("sysarch", (source, el, ctx) => {
      ctx.addChild(new SysarchBlock(this, el, source, ctx));
    });

    this.registerView(ARCH_VIEW, (leaf) => new ArchView(leaf, this));
    this.registerExtensions(["arch"], ARCH_VIEW);

    this.addCommand({
      id: "insert-codeblock",
      name: "Codeblock einfügen",
      editorCallback: (editor) => {
        const cursor = editor.getCursor();
        editor.replaceSelection("```sysarch\n" + NEW_SOURCE + "```\n");
        editor.setCursor({ line: cursor.line + 1, ch: 0 });
      },
    });

    this.addCommand({
      id: "new-arch-file",
      name: "Neue .arch-Datei",
      callback: async () => {
        const parent: TFolder = this.app.fileManager.getNewFileParent(this.app.workspace.getActiveFile()?.path ?? "");
        let path = normalizePath(`${parent.path}/Architektur.arch`);
        for (let i = 1; this.app.vault.getAbstractFileByPath(path); i++) {
          path = normalizePath(`${parent.path}/Architektur ${i}.arch`);
        }
        try {
          const file = await this.app.vault.create(path, NEW_SOURCE);
          await this.app.workspace.getLeaf(true).openFile(file);
        } catch (error) {
          new Notice(`sysarch: ${error instanceof Error ? error.message : String(error)}`);
        }
      },
    });
  }

  async loadSettings() {
    this.settings = { ...DEFAULT_SETTINGS, ...(await this.loadData()) };
  }

  async saveSettings() {
    await this.saveData(this.settings);
    for (const block of this.blocks) block.render(true);
    for (const leaf of this.app.workspace.getLeavesOfType(ARCH_VIEW)) {
      if (leaf.view instanceof ArchView) leaf.view.workbench?.refresh();
    }
  }
}

