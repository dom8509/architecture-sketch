import { THEMES } from "@sysarch/core";
import { PNG_SCALES, type PngScale } from "@sysarch/export-png";
import { PluginSettingTab, Setting, type App } from "obsidian";
import type { ThemeSetting } from "./logic.js";
import type SysarchPlugin from "./main.js";

export interface SysarchSettings {
  /** Theme für Diagramme ohne `theme` in der Quelle. */
  theme: ThemeSetting;
  pngScale: PngScale;
  /** Leer: Anhangsordner laut Vault-Einstellungen. */
  exportFolder: string;
}

export const DEFAULT_SETTINGS: SysarchSettings = {
  theme: "auto",
  pngScale: 2,
  exportFolder: "",
};

export class SysarchSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: SysarchPlugin) {
    super(app, plugin);
  }

  override display() {
    const { containerEl } = this;
    containerEl.empty();
    const { settings } = this.plugin;

    new Setting(containerEl)
      .setName("Standard-Theme")
      .setDesc("Gilt für Diagramme ohne `theme` in der Quelle. „Obsidian folgen“ wählt hell oder dunkel passend zum Modus.")
      .addDropdown((dropdown) => {
        dropdown.addOption("auto", "Obsidian folgen");
        for (const theme of THEMES) dropdown.addOption(theme, theme);
        dropdown.setValue(settings.theme).onChange(async (value) => {
          settings.theme = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("PNG-Skalierung")
      .setDesc("Auflösung beim PNG-Export.")
      .addDropdown((dropdown) => {
        for (const scale of PNG_SCALES) dropdown.addOption(String(scale), `${scale}×`);
        dropdown.setValue(String(settings.pngScale)).onChange(async (value) => {
          settings.pngScale = Number(value) as PngScale;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Exportordner")
      .setDesc("Ordner im Vault für SVG, PNG und React Flow JSON. Leer: Anhangsordner laut Obsidian-Einstellungen.")
      .addText((text) =>
        text.setPlaceholder("Anhangsordner").setValue(settings.exportFolder).onChange(async (value) => {
          settings.exportFolder = value.trim();
          await this.plugin.saveSettings();
        }));
  }
}
