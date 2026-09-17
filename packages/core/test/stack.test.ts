import { describe, expect, it } from "vitest";
import { compile, labelStem, stackIdentical } from "../src/index.js";
import { arch } from "./helpers.js";

const stacked = (body: string) => {
  const { value, diagnostics } = compile(arch(body));
  expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  return stackIdentical(value);
};
const summary = (m: ReturnType<typeof stacked>) => [...m.components.values()].map((c) => `${c.id}:${c.label}×${c.count}`);

describe("stack identical", () => {
  it("ändert ohne `stack identical` nichts", () => {
    const { value } = compile(arch(" component a1: half_bridge { label \"HB 1\" }\n component a2: half_bridge { label \"HB 2\" }"));
    expect(stackIdentical(value)).toBe(value);
  });

  it("fasst gleich verschaltete Komponenten zusammen, auch über Ketten", () => {
    const m = stacked(` stack identical
 component mcu: microcontroller
 component hb1: half_bridge { label "Half Bridge 1" }
 component hb2: half_bridge { label "Half Bridge 2" }
 component hb3: half_bridge { label "Half Bridge 3" }
 component m1: motor { label "Motor 1" }
 component m2: motor { label "Motor 2" }
 component m3: motor { label "Motor 3" }
 mcu -> hb1.IN
 mcu -> hb2.IN
 mcu -> hb3.IN
 hb1.OUT -> m1
 hb2.OUT -> m2
 hb3.OUT -> m3`);
    expect(summary(m)).toEqual(["mcu:MCU×1", "hb1:Half Bridge×3", "m1:Motor×3"]);
    expect(m.connections.map((c) => `${c.source.component}.${c.source.pin ?? ""}->${c.target.component}.${c.target.pin ?? ""}`))
      .toEqual(["mcu.->hb1.IN", "hb1.OUT->m1."]);
  });

  it("lässt unterschiedlich verschaltete Komponenten getrennt", () => {
    const m = stacked(` stack identical
 component mcu: microcontroller
 component s1: sensor { label "Sensor 1" }
 component s2: sensor { label "Sensor 2" }
 component s3: sensor { label "Sensor 3" }
 s1 -> mcu { type analog }
 s2 -> mcu { type analog }
 s3 -> mcu { type digital }`);
    expect(summary(m)).toEqual(["mcu:MCU×1", "s1:Sensor×2", "s3:Sensor 3×1"]);
  });

  it("fasst unterschiedlich benannte Bauteile nie zusammen", () => {
    const m = stacked(` stack identical
 component mcu: microcontroller
 component temp: sensor { label "Temperatur" }
 component cur: sensor { label "Strom" }
 temp -> mcu
 cur -> mcu`);
    expect(summary(m)).toEqual(["mcu:MCU×1", "temp:Temperatur×1", "cur:Strom×1"]);
  });

  it("bleibt innerhalb von Systemen und entfernt Zusammengefasstes aus Gruppen und Grid", () => {
    const m = stacked(` stack identical
 layout { grid {
  a1 | a2 | b1
 } }
 system left { component a1 { label "Load 1" } component a2 { label "Load 2" } }
 system right { component b1 { label "Load 3" } }`);
    expect(summary(m)).toEqual(["a1:Load×2", "b1:Load 3×1"]);
    expect(m.groups.get("left")!.children).toEqual(["a1"]);
    expect(m.grid!.rows).toEqual([["a1", null, "b1"]]);
  });

  it("summiert vorhandene Anzahlen", () => {
    const m = stacked(` stack identical
 component a1 { label "Load 1" count 2 }
 component a2 { label "Load 2" count 2 }`);
    expect(summary(m)).toEqual(["a1:Load×4"]);
  });
});

describe("labelStem", () => {
  it.each([
    ["Half Bridge 3", "Half Bridge"],
    ["HB1", "HB"],
    ["HB12", "HB"],
    ["Strom B", "Strom"],
    ["Motor_4", "Motor"],
    ["S32K344", "S32K344"],
    ["Temperatur", "Temperatur"],
    ["7", "7"],
  ])("%s → %s", (label, stem) => {
    expect(labelStem(label)).toBe(stem);
  });
});
