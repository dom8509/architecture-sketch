// Rendert examples/*.arch nach <Zielverzeichnis> (Standard: tmp/examples) — Hilfe beim Entwickeln.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { compile } from "../packages/core/src/index.js";
import { layout } from "../packages/layout/src/index.js";
import { renderSvg } from "../packages/render-svg/src/index.js";
import { getTheme } from "../packages/themes/src/index.js";

const out = process.argv[2] ?? "tmp/examples";
const themeOverride = process.argv[3];
mkdirSync(out, { recursive: true });
for (const file of readdirSync("examples").filter((f) => f.endsWith(".arch")).sort()) {
  const { value: model, diagnostics } = compile(readFileSync(join("examples", file), "utf8"));
  for (const d of diagnostics.filter((d) => d.severity === "error")) console.error(`${file}: ${d.code} ${d.message}`);
  const t0 = performance.now();
  const scene = layout(model, getTheme(themeOverride ?? model.theme));
  const svg = renderSvg(scene);
  writeFileSync(join(out, basename(file, ".arch") + ".svg"), svg);
  console.log(`${file}: ${scene.width}×${scene.height}, ${(performance.now() - t0).toFixed(0)} ms, ${svg.length} B`);
}
