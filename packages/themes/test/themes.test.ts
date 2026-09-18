import { CATEGORIES } from "@sysarch/core";
import { describe, expect, it } from "vitest";
import { INTER_GLYPHS, INTER_METRICS, measureLine, themes, wrapText } from "../src/index.js";

/** Relative luminance per WCAG 2.1. */
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
  it("provides the four themes from v0.1", () => {
    expect(Object.keys(themes)).toEqual(["automotive-light", "automotive-dark", "presentation", "technical"]);
  });

  for (const theme of Object.values(themes)) {
    describe(theme.name, () => {
      it("meets WCAG AA for component text on every category color", () => {
        for (const category of CATEGORIES) {
          const { fill, text } = theme.categories[category];
          expect(contrast(text, fill), `${category}: ${text} on ${fill}`).toBeGreaterThanOrEqual(4.5);
        }
      });

      it("meets WCAG AA for title, group and connection labels", () => {
        const { typography, canvas, zone } = theme;
        for (const [name, style] of Object.entries({ title: typography.title, connection: typography.connection })) {
          expect(contrast(style.color, canvas.background), name).toBeGreaterThanOrEqual(4.5);
        }
        expect(contrast(typography.group.color, zone.fill), "group on zone").toBeGreaterThanOrEqual(4.5);
      });

      it("snaps all spacing values to the grid", () => {
        const { grid, nodeGapMain, nodeGapCross, zoneGap, pinPitch, groupPadding } = theme.spacing;
        for (const value of [nodeGapMain, nodeGapCross, zoneGap, pinPitch, groupPadding]) expect(value % grid).toBe(0);
        for (const value of [...Object.values(theme.component.minWidth), ...Object.values(theme.component.minHeight)]) {
          expect(value % grid).toBe(0);
        }
      });

      it("distinguishes signal groups by more than color", () => {
        const look = Object.values(theme.lines).map((l) => `${l.width}|${l.dash?.join(",")}|${l.double}`);
        expect(new Set(look).size).toBe(look.length);
      });

      it("uses a font with embedded metrics", () => {
        expect(theme.typography.fontFamily).toBe(INTER_METRICS.family);
      });
    });
  }
});

describe("font metrics", () => {
  it("contain advance widths for Basic Latin and Latin-1 in every face", () => {
    for (const face of INTER_METRICS.faces) {
      for (let code = 0x20; code <= 0x7e; code++) expect(face.advances[String.fromCharCode(code)]).toBeGreaterThan(0);
      expect(face.advances["\u00e4"]).toBeGreaterThan(0);
    }
    expect(INTER_GLYPHS.faces.map((f) => f.weight)).toEqual(INTER_METRICS.faces.map((f) => f.weight));
  });

  it("apply kerning", () => {
    const pair = measureLine(INTER_METRICS, "AV", 16, 400);
    const single = measureLine(INTER_METRICS, "A", 16, 400) + measureLine(INTER_METRICS, "V", 16, 400);
    expect(pair).toBeLessThan(single);
  });

  it("measure heavier faces as wider", () => {
    expect(measureLine(INTER_METRICS, "Half Bridge", 13, 600)).toBeGreaterThan(measureLine(INTER_METRICS, "Half Bridge", 13, 400));
  });

  it("wrap at word boundaries and at \\n without splitting words", () => {
    expect(wrapText(INTER_METRICS, "Door Motor Driver", 13, 500, 60)).toEqual(["Door", "Motor", "Driver"]);
    expect(wrapText(INTER_METRICS, "Line 1\nLine 2", 13, 500, 1000)).toEqual(["Line 1", "Line 2"]);
    expect(wrapText(INTER_METRICS, "Extraordinarilylongword", 13, 500, 10)).toEqual(["Extraordinarilylongword"]);
  });
});
