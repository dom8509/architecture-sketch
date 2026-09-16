import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { compile, parse, type ComponentNode, type ConnectionNode, type GridNode, type LayoutStmt } from "../src/index.js";

const examplesDir = join(import.meta.dirname, "..", "..", "..", "examples");
const examples = readdirSync(examplesDir).filter((f) => f.endsWith(".arch")).sort();

describe("examples/*.arch", () => {
  it("es gibt Beispiele", () => {
    expect(examples.length).toBeGreaterThan(0);
  });

  it.each(examples)("%s parst und löst ohne Fehler und Warnungen auf", (file) => {
    const source = readFileSync(join(examplesDir, file), "utf8");
    expect(parse(source).diagnostics).toEqual([]);
    const result = compile(source);
    expect(result.diagnostics.filter((d) => d.severity !== "info")).toEqual([]);
    expect(result.value.components.size).toBeGreaterThan(0);
  });
});

describe("parse", () => {
  it("baut den Syntaxbaum mit Quellbereichen", () => {
    const source = 'architecture "A" {\n    component mcu: microcontroller { label "S32K3" }\n    mcu.PWM -> drv { type pwm }\n}';
    const { value, diagnostics } = parse(source);
    expect(diagnostics).toEqual([]);
    const [component, connection] = value.architecture!.body as [ComponentNode, ConnectionNode];
    expect(component).toMatchObject({ kind: "Component", id: { name: "mcu" }, template: { name: "microcontroller" } });
    expect(source.slice(component.span.start, component.span.end)).toBe('component mcu: microcontroller { label "S32K3" }');
    expect(component.span).toMatchObject({ line: 2, column: 5 });
    expect(connection).toMatchObject({ arrow: "->", from: { component: { name: "mcu" }, pin: { name: "PWM" } }, to: { component: { name: "drv" } } });
    expect(connection.body).toMatchObject([{ kind: "Type", value: { name: "pwm" } }]);
  });

  it("behandelt Schlüsselwörter kontextabhängig", () => {
    const { value, diagnostics } = parse('architecture "A" {\n component power: block\n component theme\n power -> theme\n theme.X -- power\n}');
    expect(diagnostics).toEqual([]);
    expect(value.architecture!.body.map((s) => s.kind)).toEqual(["Component", "Component", "Connection", "Connection"]);
  });

  it("trennt Grid-Zeilen an Zeilenumbrüchen", () => {
    const { value, diagnostics } = parse('architecture "A" {\n layout {\n  mode assisted\n  grid {\n   a | . | b\n   . | c | .\n  }\n }\n}');
    expect(diagnostics).toEqual([]);
    const layout = value.architecture!.body[0] as LayoutStmt;
    const grid = layout.body[1] as GridNode;
    expect(grid.rows.map((r) => r.cells.map((c) => c.id?.name ?? "."))).toEqual([["a", ".", "b"], [".", "c", "."]]);
  });

  it("erhält Kommentare als Trivia", () => {
    const { value } = parse('// Kopf\narchitecture "A" {\n    // vor mcu\n    component mcu\n    // am Ende\n}\n// Dateiende\n');
    const a = value.architecture!;
    expect(a.leadingTrivia.map((t) => t.text)).toEqual(["// Kopf"]);
    expect(a.body[0]!.leadingTrivia.map((t) => t.text)).toEqual(["// vor mcu"]);
    expect(a.closingTrivia?.map((t) => t.text)).toEqual(["// am Ende"]);
    expect(value.closingTrivia?.map((t) => t.text)).toEqual(["// Dateiende"]);
  });

  it("liest Pins mit Anzeigelabel, Seitenblöcke, Hints und Meta", () => {
    const { value, diagnostics } = parse(`architecture "A" {
      component mcu {
        pin power VDD "Versorgung"
        left { pin can CAN_TX pin can CAN_RX }
        hint row 2
        meta { voltage "12 V" part "S32K344" }
      }
    }`);
    expect(diagnostics).toEqual([]);
    const body = (value.architecture!.body[0] as ComponentNode).body!;
    expect(body.map((s) => s.kind)).toEqual(["Pin", "SideBlock", "Hint", "Meta"]);
    expect(body[0]).toMatchObject({ signal: { name: "power" }, name: { name: "VDD" }, label: { value: "Versorgung" } });
    expect(body[1]).toMatchObject({ side: "left", pins: [{ name: { name: "CAN_TX" } }, { name: { name: "CAN_RX" } }] });
    expect(body[2]).toMatchObject({ axis: "row", value: 2 });
  });

  it("liest Templates mit extends, shape und icon", () => {
    const { value, diagnostics } = parse('define m extends motor {\n shape circle\n icon none\n right { pin power OUT }\n}\narchitecture "A" {}');
    expect(diagnostics).toEqual([]);
    expect(value.defines[0]).toMatchObject({ name: { name: "m" }, extends: { name: "motor" } });
    expect(value.defines[0]!.body.map((s) => s.kind)).toEqual(["Shape", "Icon", "SideBlock"]);
  });
});

describe("Fehlertoleranz", () => {
  it("liefert bei kaputtem Input ein Teil-AST", () => {
    const source = `architecture "A" {
    component mcu: microcontroller {
        label "MCU"
        pin power
        pin can CAN_TX
    }
    component drv:
    component motor: motor
    mcu.CAN_TX -> motor
}`;
    const { value, diagnostics } = parse(source);
    expect(diagnostics.length).toBeGreaterThan(0);
    expect(diagnostics.every((d) => d.code === "E001")).toBe(true);
    const body = value.architecture!.body;
    const mcu = body[0] as ComponentNode;
    expect(mcu.id.name).toBe("mcu");
    // Der kaputte Pin fällt weg, der Rest der Komponente bleibt.
    expect(mcu.body!.map((s) => s.kind)).toEqual(["Label", "Pin"]);
    expect(body.map((s) => s.kind)).toContain("Connection");
    expect(body.filter((s) => s.kind === "Component").map((c) => (c as ComponentNode).id.name)).toContain("motor");
  });

  it("liefert ein Teil-AST, wenn die schließende Klammer fehlt", () => {
    const { value, diagnostics } = parse('architecture "A" {\n component a\n component b\n a -> b');
    expect(diagnostics.map((d) => d.code)).toEqual(["E001"]);
    expect(value.architecture!.body.map((s) => s.kind)).toEqual(["Component", "Component", "Connection"]);
  });

  it("synchronisiert auf das nächste Schlüsselwort in derselben Zeile", () => {
    const { value, diagnostics } = parse('architecture "A" {\n component a { size huge label "A" }\n}');
    expect(diagnostics.map((d) => d.code)).toEqual(["E001"]);
    expect((value.architecture!.body[0] as ComponentNode).body!.map((s) => s.kind)).toEqual(["Label"]);
  });

  it("überspringt unbekannte Anweisungen mit Vorschlag", () => {
    const { value, diagnostics } = parse('architecture "A" {\n component a {\n  lable "x"\n  size small\n }\n}');
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.message).toContain("meintest du `label`?");
    expect(diagnostics[0]!.suggestions).toMatchObject([{ replacement: "label" }]);
    expect((value.architecture!.body[0] as ComponentNode).body!.map((s) => s.kind)).toEqual(["Size"]);
  });

  it("endet bei beliebigem Müll ohne Absturz", () => {
    for (const source of ["}", "{{{", "architecture", 'architecture "x" { a -> }', "-> <- | : .", "define", 'architecture "A" { layout { grid { a | } } }']) {
      const { value, diagnostics } = parse(source);
      expect(value.kind).toBe("Document");
      expect(diagnostics.length).toBeGreaterThan(0);
    }
  });

  it("hält die Vorschau auch mitten im Tippen am Leben", () => {
    const source = readFileSync(join(examplesDir, "body-control-module.arch"), "utf8");
    for (let cut = 0; cut <= source.length; cut += 7) {
      const result = compile(source.slice(0, cut));
      expect(result.value.components).toBeInstanceOf(Map);
    }
  });
});
