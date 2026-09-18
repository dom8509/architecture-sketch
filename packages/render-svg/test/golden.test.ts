import { readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compile, SHAPES, standardLibrary } from "@sysarch/core";
import { layout } from "@sysarch/layout";
import { getTheme } from "@sysarch/themes";
import { describe, expect, it } from "vitest";
import { renderSvg } from "../src/index.js";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const golden = (file: string) => join(root, "tests", "golden", file);
const examples = readdirSync(join(root, "examples")).filter((f) => f.endsWith(".arch")).sort();

function build(file: string) {
  const { value, diagnostics } = compile(readFileSync(join(root, "examples", file), "utf8"));
  expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  const scene = layout(value, getTheme(value.theme));
  return { scene, svg: renderSvg(scene) };
}

// Update with `npx vitest run -u` — changes show up as a diff in review.
describe("golden files", () => {
  for (const file of examples) {
    const name = basename(file, ".arch");
    it(name, async () => {
      const { scene, svg } = build(file);
      await expect(JSON.stringify(scene, null, 2) + "\n").toMatchFileSnapshot(golden(`${name}.scene.json`));
      await expect(svg).toMatchFileSnapshot(golden(`${name}.svg`));
    });
  }

  it("cover every shape and every bundled icon at least once", () => {
    const svgs = examples.map((f) => build(f).svg).join("\n");
    for (const shape of SHAPES) expect(svgs, `shape ${shape}`).toContain(`sa-shape-${shape}`);
    for (const icon of standardLibrary().icons.keys()) expect(svgs, `icon ${icon}`).toContain(`<symbol id="sa-icon-${icon}"`);
  });
});
