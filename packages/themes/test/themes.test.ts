import { CATEGORIES } from "@sysarch/core";
import { describe, expect, it } from "vitest";
import { INTER_GLYPHS, INTER_METRICS, measureLine, themes, wrapText } from "../src/index.js";

/** Relative Leuchtdichte nach WCAG 2.1. */
function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe("Themes", () => {
  it("liefert die vier Themes aus v0.1", () => {
    expect(Object.keys(themes)).toEqual(["automotive-light", "automotive-dark", "presentation", "technical"]);
  });

  for (const theme of Object.values(themes)) {
    describe(theme.name, () => {
      it("hält WCAG AA für Komponententext auf jeder Kategoriefarbe ein", () => {
        for (const category of CATEGORIES) {
          const { fill, text } = theme.categories[category];
          expect(contrast(text, fill), `${category}: ${text} auf ${fill}`).toBeGreaterThanOrEqual(4.5);
        }
      });

      it("hält WCAG AA für Titel, Gruppen- und Verbindungslabels ein", () => {
        const { typography, canvas, zone } = theme;
        for (const [name, style] of Object.entries({ title: typography.title, connection: typography.connection })) {
          expect(contrast(style.color, canvas.background), name).toBeGreaterThanOrEqual(4.5);
        }
        expect(contrast(typography.group.color, zone.fill), "group auf zone").toBeGreaterThanOrEqual(4.5);
      });

      it("legt alle Abstände auf das Grid", () => {
        const { grid, nodeGapMain, nodeGapCross, zoneGap, pinPitch, groupPadding } = theme.spacing;
        for (const value of [nodeGapMain, nodeGapCross, zoneGap, pinPitch, groupPadding]) expect(value % grid).toBe(0);
        for (const value of [...Object.values(theme.component.minWidth), ...Object.values(theme.component.minHeight)]) {
          expect(value % grid).toBe(0);
        }
      });

      it("unterscheidet Signalgruppen nicht nur über die Farbe", () => {
        const look = Object.values(theme.lines).map((l) => `${l.width}|${l.dash?.join(",")}|${l.double}`);
        expect(new Set(look).size).toBe(look.length);
      });

      it("verwendet eine Schrift mit eingebetteten Metriken", () => {
        expect(theme.typography.fontFamily).toBe(INTER_METRICS.family);
      });
    });
  }
});

describe("Font-Metriken", () => {
  it("enthalten Advance-Widths für Basic Latin und Latin-1 in allen Schnitten", () => {
    for (const face of INTER_METRICS.faces) {
      for (let code = 0x20; code <= 0x7e; code++) expect(face.advances[String.fromCharCode(code)]).toBeGreaterThan(0);
      expect(face.advances["ä"]).toBeGreaterThan(0);
    }
    expect(INTER_GLYPHS.faces.map((f) => f.weight)).toEqual(INTER_METRICS.faces.map((f) => f.weight));
  });

  it("wenden Kerning an", () => {
    const pair = measureLine(INTER_METRICS, "AV", 16, 400);
    const single = measureLine(INTER_METRICS, "A", 16, 400) + measureLine(INTER_METRICS, "V", 16, 400);
    expect(pair).toBeLessThan(single);
  });

  it("messen schwerere Schnitte breiter", () => {
    expect(measureLine(INTER_METRICS, "Half Bridge", 13, 600)).toBeGreaterThan(measureLine(INTER_METRICS, "Half Bridge", 13, 400));
  });

  it("brechen an Wortgrenzen und an \\n um, ohne Wörter zu zerschneiden", () => {
    expect(wrapText(INTER_METRICS, "Door Motor Driver", 13, 500, 60)).toEqual(["Door", "Motor", "Driver"]);
    expect(wrapText(INTER_METRICS, "Zeile 1\nZeile 2", 13, 500, 1000)).toEqual(["Zeile 1", "Zeile 2"]);
    expect(wrapText(INTER_METRICS, "Überlangeswort", 13, 500, 10)).toEqual(["Überlangeswort"]);
  });
});
