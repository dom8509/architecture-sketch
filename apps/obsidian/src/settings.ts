import { THEMES } from "@sysarch/core";
import { PNG_SCALES, type PngScale } from "@sysarch/export-png";
import { PluginSettingTab, Setting, type App } from "obsidian";
import type { ThemeSetting } from "./logic.js";
import type SysarchPlugin from "./main.js";

export interface SysarchSettings {
  /** Theme for diagrams without a `theme` in the source. */
  theme: ThemeSetting;
  pngScale: PngScale;
  /** Empty: the attachment folder from the vault settings. */
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
      .setName("Default theme")
      .setDesc("Applies to diagrams without a `theme` in the source. \"Follow Obsidian\" picks light or dark to match the current mode.")
      .addDropdown((dropdown) => {
        dropdown.addOption("auto", "Follow Obsidian");
        for (const theme of THEMES) dropdown.addOption(theme, theme);
        dropdown.setValue(settings.theme).onChange(async (value) => {
          settings.theme = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("PNG scale")
      .setDesc("Resolution of the PNG export.")
      .addDropdown((dropdown) => {
        for (const scale of PNG_SCALES) dropdown.addOption(String(scale), `${scale}×`);
        dropdown.setValue(String(settings.pngScale)).onChange(async (value) => {
          settings.pngScale = Number(value) as PngScale;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Export folder")
      .setDesc("Folder in the vault for SVG, PNG and React Flow JSON. Empty: the attachment folder from the Obsidian settings.")
      .addText((text) =>
        text.setPlaceholder("Attachment folder").setValue(settings.exportFolder).onChange(async (value) => {
          settings.exportFolder = value.trim();
          await this.plugin.saveSettings();
        }));
  }
}
