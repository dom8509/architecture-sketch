import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import type { SceneGraph } from "@sysarch/layout";
import { fontSubsets, renderSvg } from "@sysarch/render-svg";

/**
 * SceneGraph → PNG via resvg. resvg does not understand `@font-face`, so it loads the same
 * font subsets the SVG embeds from temporary files; system fonts stay disabled.
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
