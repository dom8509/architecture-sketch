import { standardLibrary, type TemplateDef } from "@sysarch/core";
import { analyze, scopeSvg } from "@sysarch/editor";
import { ItemView, MarkdownView, Menu, Notice, type WorkspaceLeaf } from "obsidian";
import { ArchView } from "./arch-view.js";
import { componentSnippet, effectiveTheme, libraryGroups, templatePreviewSource } from "./logic.js";
import type SysarchPlugin from "./main.js";
import { isDark } from "./workbench.js";

export const LIBRARY_VIEW = "sysarch-library";

/**
 * Seitenleiste mit allen Templates der Standardbibliothek: Vorschau, Label, Pins. Klick fügt
 * `component …` an der Cursorposition der zuletzt aktiven Notiz bzw. `.arch`-Datei ein.
 */
export class LibraryView extends ItemView {
  private query = "";
  private listEl: HTMLElement | undefined;

  constructor(leaf: WorkspaceLeaf, private readonly plugin: SysarchPlugin) {
    super(leaf);
  }

  getViewType() {
    return LIBRARY_VIEW;
  }

  getDisplayText() {
    return "sysarch-Bibliothek";
  }

  override getIcon() {
    return "library";
  }

  override async onOpen() {
    this.contentEl.empty();
    this.contentEl.addClass("sysarch-library");
    const search = this.contentEl.createEl("input", {
      cls: "sysarch-library-search",
      attr: { type: "search", placeholder: "Templates filtern …", spellcheck: "false" },
    });
    search.value = this.query;
    this.registerDomEvent(search, "input", () => {
      this.query = search.value;
      this.render();
    });
    this.listEl = this.contentEl.createDiv();
    this.registerEvent(this.app.workspace.on("css-change", () => this.render()));
    this.render();
  }

  override async onClose() {
    this.contentEl.empty();
  }

  /** Nach einem Moduswechsel oder geänderten Einstellungen. */
  render() {
    const list = this.listEl;
    if (!list) return;
    list.empty();
    const groups = libraryGroups(standardLibrary(), this.query);
    if (groups.length === 0) {
      list.createDiv({ cls: "sysarch-library-empty", text: "Kein Template gefunden" });
      return;
    }
    let index = 0;
    for (const group of groups) {
      list.createEl("h6", { cls: "sysarch-library-category", text: group.title });
      const grid = list.createDiv({ cls: "sysarch-library-grid" });
      for (const template of group.templates) this.renderTemplate(grid, template, `sal${++index}`);
    }
  }

  private renderTemplate(parent: HTMLElement, template: TemplateDef, prefix: string) {
    const source = templatePreviewSource(template);
    const theme = effectiveTheme(source, this.plugin.settings.theme, isDark());
    const { svg } = analyze(source, theme);

    const item = parent.createDiv({
      cls: "sysarch-library-item",
      attr: { tabindex: "0", "aria-label": `${componentSnippet(template)} einfügen` },
    });
    if (svg !== undefined) item.createDiv({ cls: "sysarch-library-preview" }).innerHTML = scopeSvg(svg, prefix);
    const text = item.createDiv({ cls: "sysarch-library-text" });
    text.createDiv({ cls: "sysarch-library-name", text: template.name });
    const details = [template.label, template.extends && `extends ${template.extends}`].filter(Boolean).join(" · ");
    if (details) text.createDiv({ cls: "sysarch-library-details", text: details });
    if (template.pins.length > 0) {
      text.createDiv({
        cls: "sysarch-library-pins",
        text: template.pins.map((pin) => `${pin.name} (${pin.kind})`).join(", "),
      });
    }

    this.registerDomEvent(item, "click", () => this.insert(template));
    this.registerDomEvent(item, "keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        this.insert(template);
      }
    });
    this.registerDomEvent(item, "contextmenu", (event) => {
      event.preventDefault();
      const menu = new Menu();
      menu.addItem((i) => i.setTitle("Einfügen").setIcon("plus").onClick(() => this.insert(template)));
      menu.addItem((i) => i.setTitle("Kopieren").setIcon("copy").onClick(() => this.copy(template)));
      menu.showAtMouseEvent(event);
    });
  }

  /** Fügt in die zuletzt aktive Notiz oder `.arch`-Datei ein; ohne Ziel in die Zwischenablage. */
  private insert(template: TemplateDef) {
    const snippet = componentSnippet(template);
    const view = this.app.workspace.getMostRecentLeaf()?.view;
    if (view instanceof MarkdownView && view.getMode() === "source") {
      view.editor.replaceSelection(snippet);
      view.editor.focus();
    } else if (view instanceof ArchView && view.workbench) {
      const cm = view.workbench.editor.view;
      cm.dispatch({ ...cm.state.replaceSelection(snippet), scrollIntoView: true });
      cm.focus();
    } else {
      void this.copy(template);
    }
  }

  private async copy(template: TemplateDef) {
    await navigator.clipboard.writeText(componentSnippet(template));
    new Notice(`sysarch: „${componentSnippet(template)}“ kopiert`);
  }
}

/** Öffnet die Bibliothek in der rechten Seitenleiste bzw. holt sie nach vorn. */
export async function revealLibrary(plugin: SysarchPlugin) {
  const { workspace } = plugin.app;
  let leaf = workspace.getLeavesOfType(LIBRARY_VIEW)[0];
  if (!leaf) {
    leaf = workspace.getRightLeaf(false) ?? workspace.getLeaf(true);
    await leaf.setViewState({ type: LIBRARY_VIEW, active: true });
  }
  await workspace.revealLeaf(leaf);
}

