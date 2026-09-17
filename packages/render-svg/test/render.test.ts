import { compile } from "@sysarch/core";
import { layout } from "@sysarch/layout";
import { getTheme, INTER_GLYPHS, INTER_METRICS } from "@sysarch/themes";
import opentype from "opentype.js";
import { describe, expect, it } from "vitest";
import { buildFontSubset, renderSvg } from "../src/index.js";

const source = `architecture "Tür & <Fenster>" {
  component mcu: microcontroller { label "S32K3" pin pwm PWM }
  component driver: half_bridge { label "Door Motor Driver" }
  component motor: motor
  mcu.PWM -> driver.IN { label "PWM" }
  driver.OUT -> motor { label "12 V" }
}`;

const scene = () => layout(compile(source).value, getTheme("automotive-light"));

describe("renderSvg", () => {
  it("ist deterministisch", () => {
    expect(renderSvg(scene())).toBe(renderSvg(scene()));
  });

  it("erzeugt ein eigenständiges SVG ohne externe Referenzen", () => {
    const svg = renderSvg(scene());
    expect(svg.startsWith(`<svg xmlns="http://www.w3.org/2000/svg"`)).toBe(true);
    expect(svg).not.toMatch(/(href|src)="?(https?:|file:|\/\/)/);
    expect(svg.match(/href="([^"]*)"/g)!.every((h) => h.startsWith(`href="#sa-icon-`))).toBe(true);
  });

  it("maskiert Texte und setzt den Titel", () => {
    const svg = renderSvg(scene());
    expect(svg).toContain(`<title id="sa-title">Tür &amp; &lt;Fenster&gt;</title>`);
  });

  it("bettet nur verwendete Icons genau einmal ein", () => {
    const svg = renderSvg(scene());
    const symbols = [...svg.matchAll(/<symbol id="sa-icon-(\w+)"/g)].map((m) => m[1]);
    expect(symbols).toEqual(["bridge", "chip", "motor"]);
  });

  it("rundet Zahlen auf zwei Nachkommastellen", () => {
    const svg = renderSvg(scene(), { embedFont: false });
    const numbers = [...svg.matchAll(/="(-?\d+\.\d+)"/g)].map((m) => m[1]!);
    expect(numbers.every((n) => n.split(".")[1]!.length <= 2)).toBe(true);
  });

  it("trägt stabile Klassen und data-ref für Hit-Testing", () => {
    const svg = renderSvg(scene());
    expect(svg).toContain(`data-ref="pin:mcu.PWM"`);
    expect(svg).toContain(`class="sa-component sa-shape-circle sa-cat-actuator sa-importance-secondary" data-ref="component:motor"`);
    expect(svg).toContain(`data-ref="connection:mcu.PWM-&gt;driver.IN#1"`);
  });

  it("bettet die Schrift je Schnitt als @font-face ein", () => {
    const svg = renderSvg(scene());
    expect(svg.match(/@font-face/g)!.length).toBeGreaterThanOrEqual(2);
    expect(renderSvg(scene(), { embedFont: false })).not.toContain("@font-face");
  });
});

describe("Brücken", () => {
  it("zeichnet an jeder Brücke einen Halbkreis nach oben", () => {
    const scene = {
      width: 100, height: 100, background: "#FFFFFF", title: "", icons: [],
      items: [{
        type: "path" as const, points: [{ x: 0, y: 50 }, { x: 100, y: 50 }], stroke: "#000", strokeWidth: 1,
        hops: [{ x: 50, y: 50 }], hopRadius: 5,
      }],
    };
    expect(renderSvg(scene, { embedFont: false })).toContain(`d="M0 50L45 50A5 5 0 0 1 55 50L100 50"`);
  });
});

describe("Schrift-Subset", () => {
  const parse = (bytes: Uint8Array) =>
    opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);

  it("ist eine gültige TrueType-Datei mit genau den verwendeten Zeichen", () => {
    const font = parse(buildFontSubset(INTER_GLYPHS, INTER_METRICS, 500, "Motor AV"));
    expect(font.unitsPerEm).toBe(INTER_METRICS.unitsPerEm);
    expect(font.glyphs.length).toBe(1 + new Set("Motor AV").size);
    const face = INTER_METRICS.faces.find((f) => f.weight === 500)!;
    for (const char of "MotrAV") expect(font.charToGlyph(char).advanceWidth).toBe(face.advances[char]);
    expect(font.charToGlyph("x").index).toBe(0);
  });

  it("überträgt Kerning und Konturen", () => {
    const font = parse(buildFontSubset(INTER_GLYPHS, INTER_METRICS, 400, "AV"));
    expect(font.getKerningValue(font.charToGlyph("A"), font.charToGlyph("V"))).toBe(INTER_METRICS.faces[0]!.kerning["AV"]);
    const box = font.charToGlyph("A").getBoundingBox();
    expect(box.x2 - box.x1).toBeGreaterThan(1000);
  });

  it("ist deterministisch", () => {
    expect(buildFontSubset(INTER_GLYPHS, INTER_METRICS, 600, "abc")).toEqual(buildFontSubset(INTER_GLYPHS, INTER_METRICS, 600, "cba"));
  });
});
