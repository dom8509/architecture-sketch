import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import type { SceneGraph } from "@sysarch/layout";
import { fontSubsets, renderSvg } from "@sysarch/render-svg";

/**
 * SceneGraph → PNG über resvg. resvg kennt kein `@font-face`, deshalb lädt es dieselben
 * Schrift-Subsets, die das SVG einbettet, aus temporären Dateien; Systemschriften bleiben aus.
 */
export function renderPng(scene: SceneGraph, scale: number): Uint8Array {
  const dir = mkdtempSync(join(tmpdir(), "sysarch-fonts-"));
  try {
    const fontFiles = fontSubsets(scene).map(({ family, weight, data }) => {
      const file = join(dir, `${family}-${weight}.ttf`);
      writeFileSync(file, data);
      return file;
    });
    const resvg = new Resvg(renderSvg(scene), {
      fitTo: { mode: "zoom", value: scale },
      font: { fontFiles, loadSystemFonts: false, defaultFontFamily: "Inter" },
    });
    return resvg.render().asPng();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
