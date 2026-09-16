import { describe, expect, it } from "vitest";
import { compile, loadLibrary, parse, resolve, standardLibrary } from "../src/index.js";
import { arch } from "./helpers.js";

const model = (source: string) => {
  const result = compile(source);
  const errors = result.diagnostics.filter((d) => d.severity !== "info");
  expect(errors, JSON.stringify(errors, null, 1)).toEqual([]);
  return result.value;
};

describe("Dokumenteinstellungen", () => {
  it("setzt Standardwerte", () => {
    const m = model('architecture "Titel" {}');
    expect(m).toMatchObject({ title: "Titel", theme: "automotive-light", direction: "LR", layoutMode: "strict" });
    expect(m.grid).toBeUndefined();
  });

  it("übernimmt theme, direction, layout und grid", () => {
    const m = model(arch(" theme technical\n direction TB\n component a\n layout { mode assisted\n grid {\n a | .\n } }"));
    expect(m).toMatchObject({ theme: "technical", direction: "TB", layoutMode: "assisted" });
    expect(m.grid!.rows).toEqual([["a", null]]);
  });
});

describe("Komponenten", () => {
  it("Label-Vorrang: Instanz › Template › id", () => {
    const m = model(arch(' component a: motor { label "Fenster" }\n component b: motor\n component c'));
    expect([...m.components.values()].map((c) => c.label)).toEqual(["Fenster", "Motor", "c"]);
  });

  it("übernimmt Form, Icon, Kategorie und Größe aus dem Template", () => {
    const m = model(arch(" component m: motor\n component x"));
    expect(m.components.get("m")).toMatchObject({ template: "motor", shape: "circle", icon: "motor", category: "actuator", size: "small", importance: "secondary" });
    expect(m.components.get("x")).toMatchObject({ template: "block", shape: "rounded", category: "generic", size: "medium" });
    expect(m.components.get("x")!.icon).toBeUndefined();
  });

  it("Instanz überschreibt size, importance, category; speichert meta", () => {
    const m = model(arch(' component a: motor { size large importance primary category power meta { voltage "12 V" } }'));
    expect(m.components.get("a")).toMatchObject({ size: "large", importance: "primary", category: "power", meta: { voltage: "12 V" } });
  });

  it("lokale Templates erben und entfernen Icons mit `icon none`", () => {
    const result = compile(arch(" component a: quiet\n component b: window_motor", "define quiet extends motor { icon none }\ndefine window_motor extends motor { icon window }"));
    expect(result.value.components.get("a")!.icon).toBeUndefined();
    expect(result.value.components.get("a")!.shape).toBe("circle");
    expect(result.value.components.get("b")!.icon).toBe("window");
  });

  it("baut den Gruppenbaum mit groupPath", () => {
    const m = model(arch(' zone z { label "Zone"\n system ecu { label "ECU"\n system inner { component a } }\n component b }'));
    expect(m.root.children).toEqual(["z"]);
    expect(m.groups.get("z")).toMatchObject({ type: "zone", label: "Zone", children: ["ecu", "b"] });
    expect(m.groups.get("ecu")).toMatchObject({ type: "system", label: "ECU", children: ["inner"] });
    expect(m.components.get("a")!.groupPath).toEqual(["z", "ecu", "inner"]);
    expect(m.components.get("b")!.groupPath).toEqual(["z"]);
  });

  it("speichert Hints nur in mode assisted", () => {
    expect(model(arch(" layout { mode assisted }\n component a { hint row 2 hint column 3 }")).components.get("a")!.hints).toEqual({ row: 2, column: 3 });
    expect(compile(arch(" component a { hint row 2 }")).value.components.get("a")!.hints).toEqual({});
  });
});

describe("Pins", () => {
  it("Template-Pins zuerst, dann Instanz-Pins; Seiten aus Template und Block", () => {
    const m = compile(arch(" component hb: half_bridge { top { pin digital EN } }")).value;
    const pins = m.components.get("hb")!.pins;
    expect(pins.map((p) => `${p.name}:${p.side}:${p.sideSource}`)).toEqual([
      "VS:left:template", "IN:left:template", "OUT:right:template", "IS:bottom:template", "GND:bottom:template", "EN:top:explicit",
    ]);
  });

  it("Neudeklaration gleicher Art verschiebt den Pin, Position bleibt", () => {
    const pins = compile(arch(' component hb: half_bridge { right { pin digital IN "Eingang" } }')).value.components.get("hb")!.pins;
    expect(pins[1]).toMatchObject({ name: "IN", side: "right", sideSource: "explicit", label: "Eingang" });
  });

  it("leitet Seiten aus Verbindungen ab (LR)", () => {
    const m = compile(arch(" component a { pin digital OUT pin digital IN pin digital FREE pin digital BI }\n component b\n a.OUT -> b\n b -> a.IN\n a.BI <-> b")).value;
    const sides = Object.fromEntries(m.components.get("a")!.pins.map((p) => [p.name, `${p.side}:${p.sideSource}`]));
    expect(sides).toEqual({ OUT: "right:inferred", IN: "left:inferred", FREE: "left:inferred", BI: "left:inferred" });
  });

  it("leitet Seiten aus Verbindungen ab (TB)", () => {
    const m = compile(arch(" direction TB\n component a { pin digital OUT pin digital IN }\n component b\n a.OUT -> b\n a.IN <- b")).value;
    expect(m.components.get("a")!.pins.map((p) => p.side)).toEqual(["bottom", "top"]);
  });

  it("Pin-Label ist standardmäßig der Name", () => {
    const pins = compile(arch(' component a { pin power VDD pin ground GND "Masse" }')).value.components.get("a")!.pins;
    expect(pins.map((p) => p.label)).toEqual(["VDD", "Masse"]);
  });
});

describe("Verbindungen", () => {
  const conn = (body: string) => compile(arch(body)).value.connections;

  it("normalisiert Richtungen", () => {
    const c = conn(" component a\n component b\n a -> b\n a <- b\n a <-> b\n a -- b");
    expect(c.map((x) => `${x.source.component}>${x.target.component}:${x.direction}`)).toEqual([
      "a>b:forward", "b>a:forward", "a>b:bidirectional", "a>b:none",
    ]);
  });

  it("vergibt stabile IDs je Endpunktpaar", () => {
    const c = conn(" component a { pin digital X }\n component b\n a.X -> b\n a -> b\n a.X -> b\n b <- a.X");
    expect(c.map((x) => x.id)).toEqual(["a.X->b#1", "a->b#1", "a.X->b#2", "a.X->b#3"]);
  });

  it("leitet den Typ ab", () => {
    const c = conn(` component a { pin power P pin pwm PWM pin analog AN }
 component b { pin power P pin digital D }
 a.P -> b.P
 a.PWM -> b.D
 b.D <- a.AN
 a.PWM -> b
 b -> a.AN
 a -> b
 a -> b { type can label "CAN" }`);
    expect(c.map((x) => `${x.kind}:${x.kindSource}`)).toEqual([
      "power:inferred", "pwm:inferred", "analog:inferred", "pwm:inferred", "analog:inferred", "signal:inferred", "can:explicit",
    ]);
    expect(c[6]!.label).toBe("CAN");
  });

  it("verwirft Verbindungen mit ungültigen Endpunkten vollständig", () => {
    const result = compile(arch(" component a { pin digital X }\n component b\n a.Y -> b\n c -> b\n a.X -> b"));
    expect(result.value.connections.map((c) => c.id)).toEqual(["a.X->b#1"]);
  });
});

describe("Invarianten bei Fehlern", () => {
  it("jede Komponente genau einmal im Gruppenbaum, auch bei doppelten IDs und E106", () => {
    const m = compile(arch(" zone z { component a\n component a }\n component b")).value;
    const all: string[] = [];
    const walk = (children: string[]) => {
      for (const child of children) {
        const group = m.groups.get(child);
        if (group) walk(group.children);
        else all.push(child);
      }
    };
    walk(m.root.children);
    expect(all.sort()).toEqual([...m.components.keys()].sort());
  });

  it("Grid enthält nur existierende Komponenten", () => {
    const m = compile(arch(" component a\n layout { grid { a | ghost } }")).value;
    expect(m.grid!.rows).toEqual([["a", null]]);
  });

  it("unbekanntes Template fällt auf block zurück", () => {
    const m = compile(arch(" component a: nope")).value;
    expect(m.components.get("a")).toMatchObject({ template: "block", shape: "rounded" });
  });
});

describe("Bibliothek", () => {
  it("resolve nimmt eine eigene Bibliothek", () => {
    const lib = loadLibrary("define box { shape rect category external left { pin can C } }", []);
    expect(lib.diagnostics).toEqual([]);
    const result = resolve(parse(arch(" component x: box")).value, lib.value);
    expect(result.value.components.get("x")).toMatchObject({ shape: "rect", category: "external", label: "x" });
    expect(result.value.components.get("x")!.pins).toMatchObject([{ name: "C", side: "left" }]);
  });

  it("meldet Architekturen in Bibliotheken", () => {
    expect(loadLibrary('architecture "x" {}', []).diagnostics.map((d) => d.code)).toEqual(["E001"]);
  });

  it("Standardbibliothek wird nur einmal geladen", () => {
    expect(standardLibrary()).toBe(standardLibrary());
  });
});
