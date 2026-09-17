import { readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { THEMES } from "@sysarch/core";
import { describe, expect, it } from "vitest";
import { run } from "../../../apps/cli/src/cli.js";
import { analyze } from "../src/index.js";

const root = join(import.meta.dirname, "..", "..", "..");
const examples = readdirSync(join(root, "examples")).filter((f) => f.endsWith(".arch")).sort();

function cli(...argv: string[]): string {
  let stdout = "";
  const code = run(argv, { stdout: (t) => (stdout += t), stderr: () => {} });
  expect(code).toBe(0);
  return stdout;
}

// Abnahme M4: Die Vorschau zeigt byte-genau das SVG, das die CLI schreibt.
describe("Vorschau-SVG == CLI-SVG", () => {
  for (const file of examples) {
    const path = join(root, "examples", file);
    const source = readFileSync(path, "utf8");

    it(basename(file, ".arch"), () => {
      const { svg } = analyze(source);
      expect(svg).toBe(cli("render", path, "--out", "-"));
      expect(svg).toBe(readFileSync(join(root, "tests", "golden", basename(file, ".arch") + ".svg"), "utf8"));
    });

    it(`${basename(file, ".arch")} mit überschriebenem Theme`, () => {
      for (const theme of THEMES) {
        expect(analyze(source, theme).svg).toBe(cli("render", path, "--out", "-", "--theme", theme));
      }
    });
  }
});

describe("analyze", () => {
  it("liefert bei Fehlern Diagnosen und Teilmodell, aber kein SVG", () => {
    const result = analyze(`architecture "X" {\n    component a\n    a.OUT -> b\n}\n`);
    expect(result.svg).toBeUndefined();
    expect(result.diagnostics.map((d) => d.code)).toEqual(["E103", "E102"]);
    expect([...result.model.components.keys()]).toEqual(["a"]);
  });
});
