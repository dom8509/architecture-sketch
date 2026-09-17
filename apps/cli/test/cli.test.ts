import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  it("zeigt Hilfe und Version", () => {
    expect(sysarch("--help")).toMatchObject({ code: 0, stdout: expect.stringContaining("sysarch render") });
    expect(sysarch("--version")).toMatchObject({ code: 0, stdout: "0.1.0\n" });
    expect(sysarch().code).toBe(2);
  });

  it("meldet Aufruffehler mit Exit 2", () => {
    expect(sysarch("draw")).toMatchObject({ code: 2, stderr: expect.stringContaining("Unbekannter Befehl `draw`") });
    expect(sysarch("check", "--bogus", examples)).toMatchObject({ code: 2 });
    expect(sysarch("check")).toMatchObject({ code: 2, stderr: expect.stringContaining("Keine Eingabedateien") });
    expect(sysarch("check", join(root, "fehlt.arch"))).toMatchObject({ code: 2, stderr: expect.stringContaining("nicht gefunden") });
    expect(sysarch("render", join(library, "automotive.archlib"))).toMatchObject({ code: 2 });
  });
});

describe("sysarch render", () => {
  it("rendert alle Beispiele byte-gleich zu den Golden Files", () => {
    const out = tempDir();
    const result = sysarch("render", examples, "--out", out);
    expect(result.code).toBe(0);
    const svgs = readdirSync(out).sort();
    expect(svgs).toEqual(readdirSync(examples).filter((f) => f.endsWith(".arch")).map((f) => f.replace(/\.arch$/, ".svg")).sort());
    for (const svg of svgs) {
      expect(readFileSync(join(out, svg), "utf8"), svg).toBe(readFileSync(join(root, "tests", "golden", svg), "utf8"));
    }
  });

  it("schreibt mit --out - nach stdout und mit --out datei.svg in genau eine Datei", () => {
    const input = join(examples, "zonal-ecu.arch");
    const golden = readFileSync(join(root, "tests", "golden", "zonal-ecu.svg"), "utf8");
    expect(sysarch("render", input, "--out", "-")).toMatchObject({ code: 0, stdout: golden });

    const target = join(tempDir(), "sub", "bild.svg");
    expect(sysarch("render", input, "--out", target).code).toBe(0);
    expect(readFileSync(target, "utf8")).toBe(golden);

    expect(sysarch("render", examples, "--out", target)).toMatchObject({ code: 2, stderr: expect.stringContaining("genau eine Eingabedatei") });
  });

  it("schreibt ohne --out neben die Quelle", () => {
    const input = tempFile("a.arch", 'architecture "A" {\n    component a\n}\n');
    expect(sysarch("render", input).code).toBe(0);
    expect(readFileSync(input.replace(/\.arch$/, ".svg"), "utf8")).toMatch(/^<svg/);
  });

  it("überschreibt das Theme mit --theme", () => {
    const input = join(examples, "zonal-ecu.arch");
    const light = sysarch("render", input, "--out", "-").stdout;
    const dark = sysarch("render", input, "--out", "-", "--theme", "automotive-dark").stdout;
    expect(dark).not.toBe(light);
    expect(sysarch("render", input, "--theme", "neon")).toMatchObject({ code: 2, stderr: expect.stringContaining("Unbekanntes Theme") });
  });

  it("kennt in v0.1 nur SVG", () => {
    expect(sysarch("render", examples, "--format", "png")).toMatchObject({ code: 2, stderr: expect.stringContaining("geplant für M5") });
  });

  it("rendert bei Fehlern nicht und meldet sie im Compiler-Format", () => {
    const input = tempFile("kaputt.arch", 'architecture "A" {\n    component a\n    a -> b\n}\n');
    const result = sysarch("render", input, "--out", "-");
    expect(result.code).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain(`${input}:3:10: error E102: `);
  });
});

describe("sysarch check", () => {
  it("akzeptiert Beispiele und Bibliothek", () => {
    const result = sysarch("check", examples, library, "--max-warnings", "0");
    expect(result).toMatchObject({ code: 0, stdout: "" });
    expect(result.stderr).toMatch(/^6 Dateien geprüft: 0 Fehler, 0 Warnungen, \d+ Hinweise\n$/);
  });

  it("gibt Hinweise nur mit --verbose aus", () => {
    expect(sysarch("check", join(examples, "zonal-ecu.arch"), "--verbose").stdout).toContain("info I301: ");
  });

  it("endet mit Exit 1 bei Fehlern", () => {
    const input = tempFile("a.arch", 'architecture "A" {\n    component mcu: microcontroller\n    mcu.CAN_TXX -> mcu.VDD\n}\n');
    const result = sysarch("check", input);
    expect(result.code).toBe(1);
    expect(result.stdout).toMatch(new RegExp(`^${input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:3:9: error E103: `, "m"));
  });

  it("endet mit Exit 1 bei zu vielen Warnungen", () => {
    const input = tempFile("a.arch", 'architecture "A" {\n    component a {\n        hint row 1\n    }\n}\n');
    expect(sysarch("check", input).code).toBe(0);
    expect(sysarch("check", input, "--max-warnings", "1").code).toBe(0);
    expect(sysarch("check", input, "--max-warnings", "0")).toMatchObject({ code: 1, stdout: expect.stringContaining("warning W202: ") });
    expect(sysarch("check", input, "--max-warnings", "-1").code).toBe(2);
  });

  it("liefert Diagnosen als JSON", () => {
    const input = tempFile("a.arch", 'architecture "A" {\n    theme neon\n}\n');
    const result = sysarch("check", input, "--format", "json");
    expect(result.code).toBe(1);
    expect(JSON.parse(result.stdout)).toEqual([
      expect.objectContaining({ file: input, code: "E109", severity: "error", line: 2, column: 11, endLine: 2, endColumn: 15 }),
    ]);
  });

  it("prüft .archlib-Dateien als Bibliothek", () => {
    const input = tempFile("x.archlib", "define t {\n    shape star\n}\n");
    expect(sysarch("check", input)).toMatchObject({ code: 1, stdout: expect.stringContaining("error E111: ") });
  });
});

describe("sysarch fmt", () => {
  const messy = 'architecture "A" {\n  a -> b {label "x"}\n  component a\n    component b\n}\n';
  const tidy = 'architecture "A" {\n    component a\n    component b\n\n    a -> b { label "x" }\n}\n';

  it("prüft mit --check, ohne zu schreiben", () => {
    const input = tempFile("a.arch", messy);
    expect(sysarch("fmt", input, "--check")).toMatchObject({ code: 1, stdout: `${input}\n` });
    expect(readFileSync(input, "utf8")).toBe(messy);
  });

  it("formatiert in-place und ist danach stabil", () => {
    const input = tempFile("a.arch", messy);
    expect(sysarch("fmt", input).code).toBe(0);
    expect(readFileSync(input, "utf8")).toBe(tidy);
    expect(sysarch("fmt", input, "--check")).toMatchObject({ code: 0, stdout: "" });
  });

  it("lässt Dateien mit Syntaxfehlern unverändert", () => {
    const broken = 'architecture "A" {\n  component a {\n';
    const input = tempFile("a.arch", broken);
    expect(sysarch("fmt", input)).toMatchObject({ code: 1, stderr: expect.stringContaining("error E001: ") });
    expect(readFileSync(input, "utf8")).toBe(broken);
  });

  it("Beispiele und Bibliothek sind formatiert", () => {
    expect(sysarch("fmt", examples, library, "--check")).toMatchObject({ code: 0, stdout: "" });
  });
});
