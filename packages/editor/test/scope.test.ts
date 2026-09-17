import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compile } from "@sysarch/core";
import { renderArchitecture } from "@sysarch/render-svg";
import { describe, expect, it } from "vitest";
import { scopeSvg } from "../src/index.js";

const root = join(import.meta.dirname, "..", "..", "..");
const zonal = readFileSync(join(root, "examples", "zonal-ecu.arch"), "utf8");

describe("scopeSvg", () => {
  const { value: model } = compile(zonal);
  const svg = renderArchitecture(model);
  const scoped = scopeSvg(svg, "sa7");

  it("benennt Schrift, IDs und Verweise um", () => {
    expect(svg).toContain(`font-family:"Inter"`);
    expect(scoped).not.toMatch(/font-family[:=]"Inter\b/);
    expect(scoped).toContain(`font-family:"sa7-Inter"`);
    expect(scoped).not.toMatch(/(id|href)="#?sa-/);
    expect(scoped).toContain(`<title id="sa7-title">`);
    expect(scoped).toContain(`aria-labelledby="sa7-title"`);
  });

  it("jeder Verweis zeigt auf ein vorhandenes Symbol", () => {
    const ids = new Set([...scoped.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
    const refs = [...scoped.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) expect(ids).toContain(ref);
  });

  it("lässt Klassen und data-ref unverändert", () => {
    const classes = (text: string) => [...text.matchAll(/(class|data-ref)="[^"]*"/g)].map((m) => m[0]);
    expect(classes(scoped)).toEqual(classes(svg));
  });
});

