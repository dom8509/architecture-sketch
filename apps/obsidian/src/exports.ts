import type { ArchitectureModel } from "@sysarch/core";
import { svgToPng } from "@sysarch/export-png";
import { toReactFlow } from "@sysarch/export-reactflow";
import { architectureScene } from "@sysarch/render-svg";
import { normalizePath, Notice, type Menu } from "obsidian";
import { exportBaseName } from "./logic.js";
import type SysarchPlugin from "./main.js";

/** A diagram that rendered without errors, as it gets exported. */
export interface Diagram {
  model: ArchitectureModel;
  /** The unmodified SVG — byte-identical to the CLI and the web app. */
  svg: string;
  /** Theme used for rendering; `undefined` = from the source. */
  theme: string | undefined;
  /** The note or `.arch` file the diagram belongs to. */
  sourcePath: string;
}

/** Export entries for context and file menus; `diagram()` returns `undefined` on errors in the source. */
export function addExportItems(menu: Menu, plugin: SysarchPlugin, diagram: () => Diagram | undefined) {
  const run = (action: (d: Diagram) => Promise<void>) => async () => {
    const d = diagram();
    if (!d) return void new Notice("sysarch: the source contains errors — nothing to export");
    try {
      await action(d);
    } catch (error) {
      console.error("sysarch", error);
      new Notice(`sysarch: export failed — ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  menu.addItem((item) => item.setTitle("Export SVG").setIcon("image-file").onClick(run(async (d) => {
    await saved(plugin, d, ".svg", d.svg);
  })));
  menu.addItem((item) => item.setTitle("Export PNG").setIcon("image").onClick(run(async (d) => {
    const png = await svgToPng(d.svg, plugin.settings.pngScale);
    await saved(plugin, d, ".png", await png.arrayBuffer());
  })));
  menu.addItem((item) => item.setTitle("Copy SVG").setIcon("copy").onClick(run(async (d) => {
    await navigator.clipboard.writeText(d.svg);
    new Notice("SVG copied to the clipboard");
  })));
  menu.addItem((item) => item.setTitle("Export React Flow JSON").setIcon("braces").onClick(run(async (d) => {
    const flow = toReactFlow(d.model, architectureScene(d.model, d.theme));
    await saved(plugin, d, ".reactflow.json", JSON.stringify(flow, null, 2) + "\n");
  })));
}

async function saved(plugin: SysarchPlugin, d: Diagram, extension: string, data: string | ArrayBuffer) {
  const noteName = d.sourcePath.slice(d.sourcePath.lastIndexOf("/") + 1).replace(/\.[^.]*$/, "");
  const path = await writeExport(plugin, d.sourcePath, exportBaseName(d.model.title, noteName) + extension, data);
  new Notice(`Exported: ${path}`);
}

/**
 * Writes into the export folder or the attachment folder of the note. Exporting again
 * overwrites the file of the same name, so that embeds (`![[door-ecu.svg]]`) stay up to date.
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
