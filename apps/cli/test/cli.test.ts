import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compile } from "@sysarch/core";
import { describe, expect, it } from "vitest";
import { run } from "../src/cli.js";

const root = join(import.meta.dirname, "..", "..", "..");
const examples = join(root, "examples");
const library = join(root, "library");

function sysarch(...argv: string[]) {
  let stdout = "";
  let stderr = "";
  const code = run(argv, { stdout: (t) => (stdout += t), stderr: (t) => (stderr += t) });
  return { code, stdout, stderr };
}

const tempDir = () => mkdtempSync(join(tmpdir(), "sysarch-cli-"));

function tempFile(name: string, content: string): string {
  const file = join(tempDir(), name);
  writeFileSync(file, content);
  return file;
}

describe("sysarch", () => {
  it("shows help and version", () => {
    expect(sysarch("--help")).toMatchObject({ code: 0, stdout: expect.stringContaining("sysarch render") });
    expect(sysarch("--version")).toMatchObject({ code: 0, stdout: "0.1.0\n" });
    expect(sysarch().code).toBe(2);
  });

  it("reports usage errors with exit 2", () => {
    expect(sysarch("draw")).toMatchObject({ code: 2, stderr: expect.stringContaining("Unknown command `draw`") });
    expect(sysarch("check", "--bogus", examples)).toMatchObject({ code: 2 });
    expect(sysarch("check")).toMatchObject({ code: 2, stderr: expect.stringContaining("No input files") });
    expect(sysarch("check", join(root, "missing.arch"))).toMatchObject({ code: 2, stderr: expect.stringContaining("not found") });
    expect(sysarch("render", join(library, "automotive.archlib"))).toMatchObject({ code: 2 });
  });
});

describe("sysarch render", () => {
  it("renders every example byte-identical to the golden files", () => {
    const out = tempDir();
    const result = sysarch("render", examples, "--out", out);
    expect(result.code).toBe(0);
    const svgs = readdirSync(out).sort();
    // Examples with views produce one file per view, everything else one file.
    const expected = readdirSync(examples).filter((f) => f.endsWith(".arch")).flatMap((file) => {
      const base = file.replace(/\.arch$/, "");
      const { views } = compile(readFileSync(join(examples, file), "utf8")).value;
      return views.length === 0 ? [`${base}.svg`] : views.map((v) => `${base}-${v.id}.svg`);
    }).sort();
    expect(svgs).toEqual(expected);
    for (const svg of svgs) {
      const golden = join(root, "tests", "golden", svg);
      if (!existsSync(golden)) continue; // per-view renders are covered by the preview test
      expect(readFileSync(join(out, svg), "utf8"), svg).toBe(readFileSync(golden, "utf8"));
    }
  });

  it("selects a single view with --view", () => {
    const input = join(examples, "window-lifter.arch");
    const out = tempDir();
    expect(sysarch("render", input, "--view", "overview", "--out", out).code).toBe(0);
    expect(readdirSync(out)).toEqual(["window-lifter-overview.svg"]);
    expect(sysarch("render", input, "--view", "overview", "--out", "-").stdout)
      .toBe(readFileSync(join(out, "window-lifter-overview.svg"), "utf8"));

    // Without --view several views cannot share one target.
    expect(sysarch("render", input, "--out", "-")).toMatchObject({ code: 2, stderr: expect.stringContaining("--view") });
    expect(sysarch("render", input, "--view", "overviw")).toMatchObject({ code: 2, stderr: expect.stringContaining("available: overview") });
    expect(sysarch("render", join(examples, "zonal-ecu.arch"), "--view", "overview"))
      .toMatchObject({ code: 2, stderr: expect.stringContaining("declares no views") });
  });

  it("writes to stdout with --out - and to exactly one file with --out file.svg", () => {
    const input = join(examples, "zonal-ecu.arch");
    const golden = readFileSync(join(root, "tests", "golden", "zonal-ecu.svg"), "utf8");
    expect(sysarch("render", input, "--out", "-")).toMatchObject({ code: 0, stdout: golden });

    const target = join(tempDir(), "sub", "image.svg");
    expect(sysarch("render", input, "--out", target).code).toBe(0);
    expect(readFileSync(target, "utf8")).toBe(golden);

    expect(sysarch("render", examples, "--out", target)).toMatchObject({ code: 2, stderr: expect.stringContaining("exactly one input file") });
  });

  it("writes next to the source without --out", () => {
    const input = tempFile("a.arch", 'architecture "A" {\n    component a\n}\n');
    expect(sysarch("render", input).code).toBe(0);
    expect(readFileSync(input.replace(/\.arch$/, ".svg"), "utf8")).toMatch(/^<svg/);
  });

  it("overrides the theme with --theme", () => {
    const input = join(examples, "zonal-ecu.arch");
    const light = sysarch("render", input, "--out", "-").stdout;
    const dark = sysarch("render", input, "--out", "-", "--theme", "automotive-dark").stdout;
    expect(dark).not.toBe(light);
    expect(sysarch("render", input, "--theme", "neon")).toMatchObject({ code: 2, stderr: expect.stringContaining("Unknown theme") });
  });

  it("renders PNG with fonts at the chosen scale", () => {
    const input = join(examples, "zonal-ecu.arch");
    const out = tempDir();
    expect(sysarch("render", input, "--format", "png", "--out", out).code).toBe(0);
    const png = readFileSync(join(out, "zonal-ecu.png"));
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    // IHDR: width and height from byte 16 on; the golden SVG is 1184×336
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([2368, 672]);

    const single = join(out, "small.png");
    expect(sysarch("render", input, "--format", "png", "--scale", "1", "--out", single).code).toBe(0);
    expect(readFileSync(single).readUInt32BE(16)).toBe(1184);
    // Text is drawn with the embedded font: without a title the image would look different.
    const untitled = tempFile("a.arch", readFileSync(input, "utf8").replace('"Zonal ECU"', '""'));
    expect(sysarch("render", untitled, "--format", "png", "--scale", "1", "--out", join(out, "untitled.png")).code).toBe(0);
    expect(readFileSync(join(out, "untitled.png")).equals(readFileSync(single))).toBe(false);
  });

  it("renders React Flow JSON byte-identical to the golden file", () => {
    const input = join(examples, "zonal-ecu.arch");
    const golden = readFileSync(join(root, "tests", "golden", "zonal-ecu.reactflow.json"), "utf8");
    expect(sysarch("render", input, "--format", "reactflow", "--out", "-")).toMatchObject({ code: 0, stdout: golden });
    const out = tempDir();
    expect(sysarch("render", input, "--format", "reactflow", "--out", out).code).toBe(0);
    expect(readFileSync(join(out, "zonal-ecu.reactflow.json"), "utf8")).toBe(golden);
  });

  it("validates format and scale", () => {
    expect(sysarch("render", examples, "--format", "pdf")).toMatchObject({ code: 2, stderr: expect.stringContaining("available: svg, png, reactflow") });
    expect(sysarch("render", examples, "--format", "png", "--scale", "4")).toMatchObject({ code: 2, stderr: expect.stringContaining("--scale") });
    expect(sysarch("render", examples, "--scale", "2")).toMatchObject({ code: 2, stderr: expect.stringContaining("only applies to --format png") });
    expect(sysarch("render", join(examples, "zonal-ecu.arch"), "--format", "png", "--out", "-")).toMatchObject({ code: 2, stderr: expect.stringContaining("stdout") });
  });

  it("does not render on errors and reports them in compiler format", () => {
    const input = tempFile("broken.arch", 'architecture "A" {\n    component a\n    a -> b\n}\n');
    const result = sysarch("render", input, "--out", "-");
    expect(result.code).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain(`${input}:3:10: error E102: `);
  });
});

describe("sysarch check", () => {
  it("accepts the examples and the library", () => {
    const result = sysarch("check", examples, library, "--max-warnings", "0");
    expect(result).toMatchObject({ code: 0, stdout: "" });
    expect(result.stderr).toMatch(/^\d+ files checked: 0 errors, 0 warnings, \d+ infos\n$/);
  });

  it("prints infos only with --verbose", () => {
    expect(sysarch("check", join(examples, "zonal-ecu.arch"), "--verbose").stdout).toContain("info I301: ");
  });

  it("exits with 1 on errors", () => {
    const input = tempFile("a.arch", 'architecture "A" {\n    component mcu: microcontroller\n    mcu.CAN_TXX -> mcu.VDD\n}\n');
    const result = sysarch("check", input);
    expect(result.code).toBe(1);
    expect(result.stdout).toMatch(new RegExp(`^${input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:3:9: error E103: `, "m"));
  });

  it("exits with 1 on too many warnings", () => {
    const input = tempFile("a.arch", 'architecture "A" {\n    component a {\n        hint row 1\n    }\n}\n');
    expect(sysarch("check", input).code).toBe(0);
    expect(sysarch("check", input, "--max-warnings", "1").code).toBe(0);
    expect(sysarch("check", input, "--max-warnings", "0")).toMatchObject({ code: 1, stdout: expect.stringContaining("warning W202: ") });
    expect(sysarch("check", input, "--max-warnings", "-1").code).toBe(2);
  });

  it("returns diagnostics as JSON", () => {
    const input = tempFile("a.arch", 'architecture "A" {\n    theme neon\n}\n');
    const result = sysarch("check", input, "--format", "json");
    expect(result.code).toBe(1);
    expect(JSON.parse(result.stdout)).toEqual([
      expect.objectContaining({ file: input, code: "E109", severity: "error", line: 2, column: 11, endLine: 2, endColumn: 15 }),
    ]);
  });

  it("checks .archlib files as a library", () => {
    const input = tempFile("x.archlib", "define t {\n    shape star\n}\n");
    expect(sysarch("check", input)).toMatchObject({ code: 1, stdout: expect.stringContaining("error E111: ") });
  });
});

describe("sysarch fmt", () => {
  const messy = 'architecture "A" {\n  a -> b {label "x"}\n  component a\n    component b\n}\n';
  const tidy = 'architecture "A" {\n    component a\n    component b\n\n    a -> b { label "x" }\n}\n';

  it("checks with --check without writing", () => {
    const input = tempFile("a.arch", messy);
    expect(sysarch("fmt", input, "--check")).toMatchObject({ code: 1, stdout: `${input}\n` });
    expect(readFileSync(input, "utf8")).toBe(messy);
  });

  it("formats in place and is stable afterwards", () => {
    const input = tempFile("a.arch", messy);
    expect(sysarch("fmt", input).code).toBe(0);
    expect(readFileSync(input, "utf8")).toBe(tidy);
    expect(sysarch("fmt", input, "--check")).toMatchObject({ code: 0, stdout: "" });
  });

  it("leaves files with syntax errors untouched", () => {
    const broken = 'architecture "A" {\n  component a {\n';
    const input = tempFile("a.arch", broken);
    expect(sysarch("fmt", input)).toMatchObject({ code: 1, stderr: expect.stringContaining("error E001: ") });
    expect(readFileSync(input, "utf8")).toBe(broken);
  });

  it("examples and library are formatted", () => {
    expect(sysarch("fmt", examples, library, "--check")).toMatchObject({ code: 0, stdout: "" });
  });
});
