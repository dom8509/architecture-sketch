import type { ArchitectureModel } from "@sysarch/core";
import { svgToPng } from "@sysarch/export-png";
import { toReactFlow } from "@sysarch/export-reactflow";
import { architectureScene } from "@sysarch/render-svg";
import { normalizePath, Notice, type Menu } from "obsidian";
import { exportBaseName } from "./logic.js";
import type SysarchPlugin from "./main.js";

/** Ein fehlerfrei gerendertes Diagramm, wie es exportiert wird. */
export interface Diagram {
  model: ArchitectureModel;
  /** Unverändertes SVG — byte-gleich mit CLI und Web-App. */
  svg: string;
  /** Theme der Darstellung; `undefined` = aus der Quelle. */
  theme: string | undefined;
  /** Notiz bzw. `.arch`-Datei, zu der das Diagramm gehört. */
  sourcePath: string;
}

/** Export-Einträge für Kontext- und Dateimenüs; `diagram()` liefert `undefined` bei Fehlern in der Quelle. */
export function addExportItems(menu: Menu, plugin: SysarchPlugin, diagram: () => Diagram | undefined) {
  const run = (action: (d: Diagram) => Promise<void>) => async () => {
    const d = diagram();
    if (!d) return void new Notice("sysarch: Die Quelle enthält Fehler — nichts zu exportieren");
    try {
      await action(d);
    } catch (error) {
      console.error("sysarch", error);
      new Notice(`sysarch: Export fehlgeschlagen — ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  menu.addItem((item) => item.setTitle("SVG exportieren").setIcon("image-file").onClick(run(async (d) => {
    await saved(plugin, d, ".svg", d.svg);
  })));
  menu.addItem((item) => item.setTitle("PNG exportieren").setIcon("image").onClick(run(async (d) => {
    const png = await svgToPng(d.svg, plugin.settings.pngScale);
    await saved(plugin, d, ".png", await png.arrayBuffer());
  })));
  menu.addItem((item) => item.setTitle("SVG kopieren").setIcon("copy").onClick(run(async (d) => {
    await navigator.clipboard.writeText(d.svg);
    new Notice("SVG in die Zwischenablage kopiert");
  })));
  menu.addItem((item) => item.setTitle("React Flow JSON exportieren").setIcon("braces").onClick(run(async (d) => {
    const flow = toReactFlow(d.model, architectureScene(d.model, d.theme));
    await saved(plugin, d, ".reactflow.json", JSON.stringify(flow, null, 2) + "\n");
  })));
}

async function saved(plugin: SysarchPlugin, d: Diagram, extension: string, data: string | ArrayBuffer) {
  const noteName = d.sourcePath.slice(d.sourcePath.lastIndexOf("/") + 1).replace(/\.[^.]*$/, "");
  const path = await writeExport(plugin, d.sourcePath, exportBaseName(d.model.title, noteName) + extension, data);
  new Notice(`Exportiert: ${path}`);
}

/**
 * Schreibt in den Exportordner bzw. den Anhangsordner der Notiz. Ein erneuter Export
 * überschreibt die gleichnamige Datei, damit Einbettungen (`![[door-ecu.svg]]`) aktuell bleiben.
 */
async function writeExport(plugin: SysarchPlugin, sourcePath: string, name: string, data: string | ArrayBuffer): Promise<string> {
  const { vault, fileManager } = plugin.app;
  let folder: string;
  if (plugin.settings.exportFolder) {
    folder = normalizePath(plugin.settings.exportFolder);
    if (!vault.getAbstractFileByPath(folder)) await vault.createFolder(folder);
  } else {
    const available = await fileManager.getAvailablePathForAttachment(name, sourcePath);
    folder = available.includes("/") ? available.slice(0, available.lastIndexOf("/")) : "";
  }
  const path = normalizePath(folder ? `${folder}/${name}` : name);
  const existing = vault.getFileByPath(path);
  if (typeof data === "string") {
    if (existing) await vault.modify(existing, data);
    else await vault.create(path, data);
  } else {
    if (existing) await vault.modifyBinary(existing, data);
    else await vault.createBinary(path, data);
  }
  return path;
}
