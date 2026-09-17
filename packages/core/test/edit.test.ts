import { describe, expect, it } from "vitest";
import { applyEdits, codeActions, compile, parse, type CodeAction } from "../src/index.js";
import { arch } from "./helpers.js";

/** Quick-Fixes zur ersten Diagnose mit `code`. */
function actions(source: string, code: string): CodeAction[] {
  const { value, diagnostics } = compile(source);
  const d = diagnostics.find((x) => x.code === code);
  expect(d, `${code} erwartet`).toBeDefined();
  return codeActions(source, parse(source).value, value, d!);
}

const errors = (source: string) => compile(source).diagnostics.filter((d) => d.severity === "error");

describe("applyEdits", () => {
  it("wendet Edits unabhängig von ihrer Reihenfolge an", () => {
    expect(applyEdits("abcdef", [
      { start: 0, end: 1, newText: "A" },
      { start: 6, end: 6, newText: "!" },
      { start: 2, end: 4, newText: "" },
    ])).toBe("Abef!");
  });
});

describe("codeActions", () => {
  it("macht aus Vorschlägen Ersetzungen", () => {
    const source = arch(`    component mcu: microcontroller\n    component trx: can_transceiver\n    mcu -> trx.TXDD`);
    const [replace] = actions(source, "E103");
    expect(replace!.label).toBe("Ersetzen durch `TXD`");
    expect(errors(applyEdits(source, replace!.edits))).toEqual([]);
  });

  it("E103: legt den Pin mit der Art der Gegenseite in einem mehrzeiligen Rumpf an", () => {
    const source = arch(`    component mcu: microcontroller {\n        label "MCU"\n    }\n    component trx: can_transceiver\n    mcu.TX_CAN -> trx.TXD`);
    const create = actions(source, "E103").at(-1)!;
    expect(create.label).toBe("Pin `TX_CAN` (digital) in `mcu` anlegen");
    const fixed = applyEdits(source, create.edits);
    expect(fixed).toContain(`        label "MCU"\n        pin digital TX_CAN\n    }`);
    expect(errors(fixed)).toEqual([]);
  });

  it("E103: nimmt `type` der Verbindung und folgt Einzeiler, leerem und fehlendem Rumpf", () => {
    const cases: [string, string][] = [
      [`component a: block { label "A" }`, `component a: block { label "A"   pin can X }`],
      [`component a {}`, `component a { pin can X }`],
      [`component a: block`, `component a: block { pin can X }`],
    ];
    for (const [before, after] of cases) {
      const source = arch(`    ${before}\n    component b\n    a.X -> b { type can }`);
      const fixed = applyEdits(source, actions(source, "E103").at(-1)!.edits);
      expect(fixed).toContain(after);
      expect(errors(fixed)).toEqual([]);
    }
  });

  it("E103: findet Komponenten in Zonen und Systemen; ohne Hinweis wird es `signal`", () => {
    const source = arch(`    zone z {\n        system s {\n            component a\n        }\n        component b\n    }\n    b -> a.IN`);
    const create = actions(source, "E103").at(-1)!;
    expect(create.label).toBe("Pin `IN` (signal) in `a` anlegen");
    expect(applyEdits(source, create.edits)).toContain(`component a { pin signal IN }`);
  });

  it("andere Diagnosen ohne Vorschlag haben keine Quick-Fixes", () => {
    const source = arch(`    component a: nope_template`);
    const { value, diagnostics } = compile(source);
    const d = diagnostics.find((x) => x.severity === "error")!;
    expect(codeActions(source, parse(source).value, value, { ...d, suggestions: undefined } as never)).toEqual([]);
  });
});
