import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { svgSize } from "../src/index.js";

describe("svgSize", () => {
  it("reads the size from the root element", () => {
    const svg = readFileSync(fileURLToPath(new URL("../../../tests/golden/zonal-ecu.svg", import.meta.url)), "utf8");
    expect(svgSize(svg)).toEqual({ width: 1184, height: 336 });
  });

  it("ignores width/height of nested elements and requires a size", () => {
    expect(svgSize('<svg xmlns="http://www.w3.org/2000/svg" width="40.5" height="8"><rect width="1" height="1"/></svg>')).toEqual({ width: 40.5, height: 8 });
    expect(() => svgSize('<svg viewBox="0 0 1 1"><rect width="1" height="1"/></svg>')).toThrow();
  });
});
