import { describe, expect, it } from "vitest";
import { DIAGNOSTIC_CODES, closest, compile, levenshtein, type DiagnosticCode } from "../src/index.js";
import { arch } from "./helpers.js";

interface Case {
  name: string;
  source: string;
  /** Erwartete Stelle "zeile:spalte" der ersten Diagnose dieses Codes. */
  at?: string;
  message?: string;
  suggestion?: string;
}

const cases: Record<DiagnosticCode, Case[]> = {
  E001: [
    { name: "fehlendes Token", source: 'architecture "A" {\n component : block\n}', at: "2:12" },
    { name: "falscher Wert für size", source: arch(" component a { size huge }"), message: "`small` | `medium` | `large`" },
    { name: "count kleiner 1", source: arch(" component a { count 0 }"), at: "3:22" },
    { name: "Hint kleiner 1", source: arch(" layout { mode assisted }\n component a { hint row 0 }"), at: "4:25" },
    { name: "define nach architecture", source: 'architecture "A" {}\ndefine x {}', at: "2:8" },
    { name: "unerwartetes Zeichen", source: arch(" component a,"), message: "unerwartetes Zeichen `,`" },
    { name: "fehlende architecture", source: "define x {}" },
  ],
  E101: [
    { name: "doppelte Komponenten-ID", source: arch(" zone z1 { component a }\n zone z2 { system a { component b } }\n zone z3 { component b }"), at: "4:19" },
    { name: "doppeltes Template", source: arch("", "define t {}\ndefine t {}"), at: "2:8" },
  ],
  E102: [
    { name: "in Verbindung", source: arch(" component mcu\n mcu -> mcx"), at: "4:9", suggestion: "mcu" },
    { name: "im Grid", source: arch(" component mcu\n layout { grid { mcu | drv } }"), at: "4:24" },
  ],
  E103: [
    {
      name: "Tippfehler im Pin",
      source: arch(" component mcu { pin can CAN_TX }\n component trx: can_transceiver\n mcu.CAN_TXX -> trx.TXD"),
      at: "5:6",
      suggestion: "CAN_TX",
    },
  ],
  E104: [
    { name: "unbekanntes Template", source: arch(" component mcu: microcontroler"), at: "3:17", suggestion: "microcontroller" },
    { name: "unbekannte Basis", source: arch(" component m: m2", "define m2 extends motr {}"), at: "1:19", suggestion: "motor" },
    { name: "zyklische Vererbung", source: arch("", "define a extends b {}\ndefine b extends a {}") },
  ],
  E105: [
    { name: "doppelter Pin", source: arch(" component a { pin power VDD\n pin power VDD }"), at: "4:12" },
    { name: "Neudeklaration mit anderer Art", source: arch(" component hb: half_bridge { right { pin analog IN } }"), at: "3:42" },
  ],
  E106: [
    { name: "Komponente außerhalb einer Zone", source: arch(" zone z { component a }\n component b\n system s { component c }"), at: "4:12" },
  ],
  E107: [
    { name: "Zellen einer Komponente bilden kein Rechteck", source: arch(" component a\n component b\n layout { grid {\n a | b\n b | .\n } }"), at: "7:2" },
    { name: "Zellen mit Lücke", source: arch(" component a\n component b\n layout { grid {\n a | b | a\n } }"), at: "6:10" },
    { name: "unterschiedlich breite Zeilen", source: arch(" component a\n component b\n layout { grid {\n a | b\n .\n } }"), at: "7:2" },
  ],
  E108: [
    {
      name: "Grid verletzt Zonen-Reihenfolge",
      source: arch(" zone z1 { component a }\n zone z2 { component b }\n layout { grid { b | a } }"),
      at: "5:18",
    },
    {
      name: "Hint verletzt Zonen-Reihenfolge",
      source: arch(" layout { mode assisted }\n zone z1 { component a { hint column 3 } }\n zone z2 { component b { hint column 2 } }"),
      at: "5:26",
    },
    {
      name: "TB prüft Zeilen",
      source: arch(" direction TB\n zone z1 { component a }\n zone z2 { component b }\n layout { grid {\n b\n a\n } }"),
      at: "7:2",
    },
  ],
  E109: [
    { name: "unbekannte Signalart", source: arch(" component a { pin powr VDD }"), at: "3:20", suggestion: "power" },
    { name: "unbekannte Kategorie", source: arch(" component a { category sensr }"), suggestion: "sensor" },
    { name: "unbekanntes Theme", source: arch(" theme automotive-lite"), at: "3:8", suggestion: "automotive-light" },
    { name: "unbekannter Verbindungstyp", source: arch(" component a\n component b\n a -> b { type cann }"), suggestion: "can" },
  ],
  E110: [
    { name: "use", source: 'use "nxp.archlib"\narchitecture "A" {}', at: "1:1", message: "v0.2" },
    { name: "view", source: arch(" view overview\n component a"), at: "3:2" },
    { name: "show in", source: arch(" component a { show in overview, detailed }"), at: "3:16" },
    { name: "interface in define", source: arch("", "define s extends microcontroller { interface can CAN0 }"), message: "v0.3" },
    { name: "rule", source: 'rule no_direct_can { }\narchitecture "A" {}', at: "1:1" },
  ],
  E111: [
    { name: "unbekannte Form", source: arch("", "define t { shape hexagn }"), at: "1:18", suggestion: "hexagon" },
    { name: "unbekanntes Icon", source: arch(" component m: t", "define t extends motor { icon moter }"), at: "1:31", suggestion: "motor" },
  ],
  W201: [
    { name: "power → can", source: arch(" component a { pin power P }\n component b { pin can C }\n a.P -> b.C"), at: "5:2" },
  ],
  W202: [
    { name: "hint in strict", source: arch(" component a { hint row 1 }"), at: "3:16" },
  ],
  W203: [
    { name: "lokales define überschreibt Bibliothek", source: arch(" component m: motor", "define motor extends motor { icon window }"), at: "1:8" },
  ],
  I301: [
    { name: "Pin ohne Verbindung", source: arch(" component a { pin power VDD }"), at: "3:16" },
  ],
};

describe("Diagnosen", () => {
  it("jeder Code hat mindestens einen Test", () => {
    for (const code of DIAGNOSTIC_CODES) expect(cases[code]?.length, code).toBeGreaterThan(0);
  });

  for (const code of DIAGNOSTIC_CODES) {
    describe(code, () => {
      it.each(cases[code])("$name", ({ source, at, message, suggestion }) => {
        const { diagnostics } = compile(source);
        const found = diagnostics.filter((d) => d.code === code);
        expect(found.length, JSON.stringify(diagnostics, null, 1)).toBeGreaterThan(0);
        const first = found[0]!;
        expect(first.severity).toBe(code.startsWith("E") ? "error" : code.startsWith("W") ? "warning" : "info");
        if (at) expect(`${first.span.line}:${first.span.column}`).toBe(at);
        if (message) expect(first.message).toContain(message);
        if (suggestion) expect(first.suggestions?.map((s) => s.replacement)).toContain(suggestion);
      });
    });
  }

  it("W201 entfällt bei explizitem type", () => {
    const source = arch(" component a { pin power P }\n component b { pin can C }\n a.P -> b.C { type power }");
    expect(compile(source).diagnostics.map((d) => d.code)).not.toContain("W201");
  });

  it("Hints in mode assisted erzeugen keine Warnung", () => {
    const source = arch(" layout { mode assisted }\n component a { hint row 1 }");
    expect(compile(source).diagnostics).toEqual([]);
  });

  it("Diagnosen sind nach Quellposition sortiert", () => {
    const { diagnostics } = compile(arch(" component a: nope\n a -> b\n component c { pin powr X }"));
    const starts = diagnostics.map((d) => d.span.start);
    expect(starts).toEqual([...starts].sort((x, y) => x - y));
  });
});

describe("Vorschläge", () => {
  it("levenshtein", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("", "abc")).toBe(3);
  });

  it("schlägt nur nahe Kandidaten vor", () => {
    expect(closest("CAN_TXX", ["CAN_TX", "CAN_RX", "VDD"])).toBe("CAN_TX");
    expect(closest("can_tx", ["CAN_TX", "VDD"])).toBe("CAN_TX");
    expect(closest("xyz", ["CAN_TX", "VDD"])).toBeUndefined();
  });
});
