import { compile } from "@sysarch/core";
import { layout } from "@sysarch/layout";
import { getTheme, INTER_GLYPHS, INTER_METRICS } from "@sysarch/themes";
import opentype from "opentype.js";
import { describe, expect, it } from "vitest";
import { buildFontSubset, renderSvg } from "../src/index.js";

const source = `architecture "Door & <Window>" {
  component mcu: microcontroller { label "S32K3" pin pwm PWM }
  component driver: half_bridge { label "Door Motor Driver" }
  component motor: motor
  mcu.PWM -> driver.IN { label "PWM" }
  driver.OUT -> motor { label "12 V" }
}`;

const scene = () => layout(compile(source).value, getTheme("automotive-light"));

describe("renderSvg", () => {
  it("draws multiplicity as a stack: back cards first, the smaller card in front", () => {
    const svg = renderSvg(layout(compile(`architecture "A" { component hb: half_bridge { count 3 } }`).value, getTheme("automotive-light")));
    const group = /<g class="sa-component[^"]*" data-ref="component:hb">(.*?)<\/g>/.exec(svg);
    expect(group).not.toBeNull();
    const rects = [...group![1]!.matchAll(/<rect x="([\d.]+)" y="([\d.]+)"/g)].map((m) => [Number(m[1]), Number(m[2])]);
    expect(rects).toHaveLength(3);
    // Back = further up and to the right.
    expect(rects[0]![0]!).toBeGreaterThan(rects[2]![0]!);
    expect(rects[0]![1]!).toBeLessThan(rects[2]![1]!);
    expect(svg).toContain(">×3<");
  });

  it("is deterministic", () => {
    expect(renderSvg(scene())).toBe(renderSvg(scene()));
  });

  it("produces a standalone SVG without external references", () => {
    const svg = renderSvg(scene());
    expect(svg.startsWith(`<svg xmlns="http://www.w3.org/2000/svg"`)).toBe(true);
    expect(svg).not.toMatch(/(href|src)="?(https?:|file:|\/\/)/);
    expect(svg.match(/href="([^"]*)"/g)!.every((h) => h.startsWith(`href="#sa-icon-`))).toBe(true);
  });

  it("escapes text and sets the title", () => {
    const svg = renderSvg(scene());
    expect(svg).toContain(`<title id="sa-title">Door &amp; &lt;Window&gt;</title>`);
  });

  it("embeds only the icons in use, exactly once each", () => {
    const svg = renderSvg(scene());
    const symbols = [...svg.matchAll(/<symbol id="sa-icon-(\w+)"/g)].map((m) => m[1]);
    expect(symbols).toEqual(["bridge", "chip", "motor"]);
  });

  it("rounds numbers to two decimal places", () => {
    const svg = renderSvg(scene(), { embedFont: false });
    const numbers = [...svg.matchAll(/="(-?\d+\.\d+)"/g)].map((m) => m[1]!);
    expect(numbers.every((n) => n.split(".")[1]!.length <= 2)).toBe(true);
  });

  it("carries stable classes and data-ref for hit testing", () => {
    const svg = renderSvg(scene());
    expect(svg).toContain(`data-ref="pin:mcu.PWM"`);
    expect(svg).toContain(`class="sa-component sa-shape-circle sa-cat-actuator sa-importance-secondary" data-ref="component:motor"`);
    expect(svg).toContain(`data-ref="connection:mcu.PWM-&gt;driver.IN#1"`);
  });

  it("embeds the font per weight as @font-face", () => {
    const svg = renderSvg(scene());
    expect(svg.match(/@font-face/g)!.length).toBeGreaterThanOrEqual(2);
    expect(renderSvg(scene(), { embedFont: false })).not.toContain("@font-face");
  });
});

describe("bridges", () => {
  it("draws an upward semicircle at every bridge", () => {
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

describe("font subset", () => {
  const parse = (bytes: Uint8Array) =>
    opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);

  it("is a valid TrueType file with exactly the characters in use", () => {
    const font = parse(buildFontSubset(INTER_GLYPHS, INTER_METRICS, 500, "Motor AV"));
    expect(font.unitsPerEm).toBe(INTER_METRICS.unitsPerEm);
    expect(font.glyphs.length).toBe(1 + new Set("Motor AV").size);
    const face = INTER_METRICS.faces.find((f) => f.weight === 500)!;
    for (const char of "MotrAV") expect(font.charToGlyph(char).advanceWidth).toBe(face.advances[char]);
    expect(font.charToGlyph("x").index).toBe(0);
  });

  it("carries over kerning and contours", () => {
    const font = parse(buildFontSubset(INTER_GLYPHS, INTER_METRICS, 400, "AV"));
    expect(font.getKerningValue(font.charToGlyph("A"), font.charToGlyph("V"))).toBe(INTER_METRICS.faces[0]!.kerning["AV"]);
    const box = font.charToGlyph("A").getBoundingBox();
    expect(box.x2 - box.x1).toBeGreaterThan(1000);
  });

  it("is deterministic", () => {
    expect(buildFontSubset(INTER_GLYPHS, INTER_METRICS, 600, "abc")).toEqual(buildFontSubset(INTER_GLYPHS, INTER_METRICS, 600, "cba"));
  });
});
