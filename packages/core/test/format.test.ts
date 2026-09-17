import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { compile, format, lex, loadLibrary, standardLibrary } from "../src/index.js";

const root = join(import.meta.dirname, "..", "..", "..");
const sources = [
  ...readdirSync(join(root, "examples")).filter((f) => f.endsWith(".arch")).sort().map((f) => join("examples", f)),
  join("library", "automotive.archlib"),
];
const read = (file: string) => readFileSync(join(root, file), "utf8");

const fmt = (source: string) => {
  const { value, diagnostics } = format(source);
  expect(diagnostics).toEqual([]);
  return value;
};

/** Semantisches Modell ohne Quellbereiche — muss vor und nach dem Formatieren gleich sein. */
function semantics(source: string): unknown {
  const strip = (value: unknown): unknown => {
    if (value instanceof Map) return [...value].map(([k, v]) => [k, strip(v)]);
    if (Array.isArray(value)) return value.map(strip);
    if (typeof value !== "object" || value === null) return value;
    return Object.fromEntries(
      Object.entries(value).filter(([k]) => k !== "span" && k !== "origin").map(([k, v]) => [k, strip(v)]),
    );
  };
  const result = source.includes("architecture")
    ? compile(source)
    : loadLibrary(source, [...standardLibrary().icons.values()]);
  return strip({ model: result.value, codes: result.diagnostics.map((d) => d.code) });
}

describe("format: Beispiele und Bibliothek", () => {
  it.each(sources)("%s ist kanonisch formatiert", (file) => {
    const source = read(file);
    expect(fmt(source)).toBe(source);
  });

  it.each(sources)("%s: Kommentare vor jedem Token bleiben erhalten, Ergebnis ist idempotent", (file) => {
    // Blockkommentare ohne Zeilenumbruch ändern die Bedeutung nicht, landen aber an jeder
    // denkbaren Stelle — auch mitten in Anweisungen, Endpunkten und Grid-Zeilen.
    const source = read(file);
    let noisy = "";
    let pos = 0;
    lex(source).tokens.forEach((t, k) => {
      noisy += source.slice(pos, t.span.start) + `/* c${k} */ `;
      pos = t.span.start;
    });
    noisy += source.slice(pos);

    const once = fmt(noisy);
    expect(fmt(once)).toBe(once);
    expect(semantics(once)).toEqual(semantics(source));
  });
});

describe("format", () => {
  const arch = (body: string) => `architecture "A" {\n${body}\n}\n`;

  it("ordnet theme › direction › pins › stack › layout › Struktur › Verbindungen, Rest in Quelltextreihenfolge", () => {
    const source = arch([
      "a -> b",
      "pins none",
      "stack identical",
      "component b",
      "direction TB",
      "layout { mode strict }",
      "zone z { component a }",
      "theme technical",
      "b -> a",
    ].join("\n"));
    expect(fmt(source)).toBe(arch([
      "    theme technical",
      "    direction TB",
      "    pins none",
      "    stack identical",
      "",
      "    layout {",
      "        mode strict",
      "    }",
      "",
      "    component b",
      "    zone z {",
      "        component a",
      "    }",
      "",
      "    a -> b",
      "    b -> a",
    ].join("\n")));
    expect(semantics(fmt(source))).toEqual(semantics(source));
  });

  it("schreibt count wie hint, einzeln als Einzeiler", () => {
    expect(fmt(arch("component a {\n count   3\n}"))).toBe(arch("    component a { count 3 }"));
    expect(fmt(arch("component a { label \"A\" count 3 }"))).toBe(arch("    component a {\n        label \"A\"\n        count 3\n    }"));
  });

  it("schreibt Einzeiler nur für einfache Blöcke", () => {
    const source = arch([
      'component a: block {   label "A"   }',
      "component b { size small importance primary }",
      "component c {}",
      "component d { pin can TX }",
      'a.X -> b { label "x"   type can }',
      'a.Y -> b { label "y" type can label "z" }',
      "c -> d {}",
    ].join("\n"));
    expect(fmt(source)).toBe(arch([
      '    component a: block { label "A" }',
      "    component b {",
      "        size small",
      "        importance primary",
      "    }",
      "    component c",
      "    component d {",
      "        pin can TX",
      "    }",
      "",
      '    a.X -> b { label "x" type can }',
      "    a.Y -> b {",
      '        label "y"',
      "        type can",
      '        label "z"',
      "    }",
      "    c -> d",
    ].join("\n")));
  });

  it("richtet Inline-Blöcke von Verbindungen bündig aus, Leerzeilen und mehrzeilige Blöcke trennen Gruppen", () => {
    const source = arch([
      'a -> b { label "1" }',
      "long_name.PIN -> b",
      'b -> c { label "2" }',
      "",
      'c -> d { label "3" }',
    ].join("\n"));
    expect(fmt(source)).toBe(arch([
      '    a -> b { label "1" }',
      "    long_name.PIN -> b",
      '    b -> c { label "2" }',
      "",
      '    c -> d { label "3" }',
    ].join("\n")));

    const aligned = arch(['    x.OUT -> y.IN { label "1" }', '    y -> z        { label "2" }'].join("\n"));
    expect(fmt(aligned)).toBe(aligned);
  });

  it("schreibt Seitenblöcke mit bis zu drei Pins ohne Label einzeilig und richtet sie aus", () => {
    const source = [
      "define t {",
      "    left { pin power VIN pin digital EN }",
      "    right { pin power VOUT }",
      '    top { pin can TX "Transmit" }',
      "    bottom { pin ground GND pin ground AGND pin ground PGND pin ground DGND }",
      "}",
      "",
    ].join("\n");
    expect(fmt(source)).toBe([
      "define t {",
      "    left  { pin power VIN   pin digital EN }",
      "    right { pin power VOUT }",
      "    top {",
      '        pin can TX "Transmit"',
      "    }",
      "    bottom {",
      "        pin ground GND",
      "        pin ground AGND",
      "        pin ground PGND",
      "        pin ground DGND",
      "    }",
      "}",
      "",
    ].join("\n"));
  });

  it("bricht Seitenblöcke um, die breiter als 80 Zeichen würden", () => {
    const source = "define t {\n    left { pin analog CURRENT_SENSE_A pin analog CURRENT_SENSE_B pin analog CURRENT_SENSE_C }\n}\n";
    expect(fmt(source)).toContain("    left {\n        pin analog CURRENT_SENSE_A\n");
  });

  it("richtet Grid-Spalten aus", () => {
    const source = arch("layout {\ngrid {\nbattery|.|mcu\n.   |   regulator   |  wdg\n}\n}");
    expect(fmt(source)).toBe(arch([
      "    layout {",
      "        grid {",
      "            battery | .         | mcu",
      "            .       | regulator | wdg",
      "        }",
      "    }",
    ].join("\n")));
  });

  it("normalisiert Leerzeilen, Einrückung, Zeilenenden und Strings", () => {
    const source = '\n\n\r\narchitecture   "A \\"B\\"\\n\\\\"{\r\n\r\n\r\n\tcomponent a\r\n\r\n\r\n\r\n\tcomponent b\r\n\r\n}\r\n\r\n';
    expect(fmt(source)).toBe('architecture "A \\"B\\"\\n\\\\" {\n    component a\n\n    component b\n}\n');
  });

  it("schreibt leere Blöcke kompakt", () => {
    expect(fmt('define t {}\narchitecture "A" { zone z { } }')).toBe('define t {}\n\narchitecture "A" {\n    zone z {}\n}\n');
  });

  it("lässt Quelltext mit Syntaxfehlern unverändert", () => {
    const source = 'architecture "A" {\n  component a {\n';
    const { value, diagnostics } = format(source);
    expect(value).toBe(source);
    expect(diagnostics.map((d) => d.code)).toContain("E001");
  });

  it("formatiert Dateien, deren Resolver Fehler meldet", () => {
    expect(fmt('architecture "A" {\na -> unknown.X\n}')).toBe('architecture "A" {\n    a -> unknown.X\n}\n');
  });
});

describe("format: Kommentare", () => {
  const cases: [string, string, string][] = [
    [
      "Kommentare auf eigenen Zeilen wandern mit ihrer Anweisung",
      '// Datei\n\narchitecture "A" {\n    a -> b\n\n    // Komponente\n    component a\n}\n',
      '// Datei\n\narchitecture "A" {\n    // Komponente\n    component a\n\n    a -> b\n}\n',
    ],
    [
      "Kommentare am Zeilenende bleiben an ihrer Zeile, auch nach dem Umsortieren",
      'architecture "A" { // Titel\n    a -> b // Verbindung\n    theme technical // Theme\n}\n',
      'architecture "A" { // Titel\n    theme technical // Theme\n\n    a -> b // Verbindung\n}\n',
    ],
    [
      "ein Kommentar im Block verhindert den Einzeiler",
      'architecture "A" {\n    component a { label "A" // Label\n    }\n    a -> b { /* x */ type can }\n}\n',
      'architecture "A" {\n    component a {\n        label "A" // Label\n    }\n\n    a -> b { /* x */\n        type can\n    }\n}\n',
    ],
    [
      "Kommentar am Ende eines Blocks und der Datei",
      'architecture "A" {\n    component a {\n        label "A"\n\n        // Ende\n\n    }\n}\n// Datei-Ende\n',
      'architecture "A" {\n    component a {\n        label "A"\n\n        // Ende\n    }\n}\n// Datei-Ende\n',
    ],
    [
      "leerer Block mit Kommentar",
      'architecture "A" {\n    component a { // nichts\n    }\n    zone z {\n        // leer\n    }\n}\n',
      'architecture "A" {\n    component a { // nichts\n    }\n    zone z {\n        // leer\n    }\n}\n',
    ],
    [
      "Kommentare mitten in einer Anweisung wandern davor",
      'architecture "A" {\n    component /* id */ a: /* t */ block\n    a.X /* pfeil */ -> b\n}\n',
      'architecture "A" {\n    /* id */\n    /* t */\n    component a: block\n\n    /* pfeil */\n    a.X -> b\n}\n',
    ],
    [
      "Kommentare in Grid-Zeilen",
      'architecture "A" {\n    layout {\n        grid {\n            a | /* leer */ . // Zeile 1\n            // Zeile 2\n            b | c\n        }\n    }\n}\n',
      'architecture "A" {\n    layout {\n        grid {\n            /* leer */\n            a | . // Zeile 1\n            // Zeile 2\n            b | c\n        }\n    }\n}\n',
    ],
  ];

  it.each(cases)("%s", (_, source, expected) => {
    expect(fmt(source)).toBe(expected);
    expect(fmt(expected)).toBe(expected);
  });
});
