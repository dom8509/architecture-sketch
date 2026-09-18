import { describe, expect, it } from "vitest";
import { themes } from "@sysarch/themes";
import { shapeGeometry, stackedGeometry, textBounds, type Rect, type SceneGraph, type SceneShape, type SceneText } from "../src/index.js";
import { appendUnconnected, examples, render, withDirection } from "./helpers.js";

const EPS = 0.01;

const contains = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x - EPS && inner.y >= outer.y - EPS &&
  inner.x + inner.width <= outer.x + outer.width + EPS && inner.y + inner.height <= outer.y + outer.height + EPS;

const shapes = (scene: SceneGraph) => scene.items.filter((i): i is SceneShape => i.type === "shape");
const connections = (scene: SceneGraph) =>
  scene.items.filter((i) => i.type === "path" && i.className?.startsWith("sa-connection")).map((i) => i as Extract<typeof i, { type: "path" }>);

function checkProperties(scene: SceneGraph, grid: number, padding: number): void {
  const bodies = shapes(scene);

  // No overlapping components.
  for (let a = 0; a < bodies.length; a++) {
    for (let b = a + 1; b < bodies.length; b++) {
      const p = bodies[a]!;
      const q = bodies[b]!;
      const overlap = p.x < q.x + q.width && q.x < p.x + p.width && p.y < q.y + q.height && q.y < p.y + p.height;
      expect(overlap, `${p.ref} overlaps ${q.ref}`).toBe(false);
    }
  }

  // Components and pins on the grid.
  for (const s of bodies) {
    for (const v of [s.x, s.y, s.width, s.height]) expect(v % grid, `${s.ref} not on the grid`).toBe(0);
  }
  for (const pin of scene.items.filter((i) => i.type === "marker" && i.shape === "pin")) {
    if (pin.type !== "marker") continue;
    expect(pin.x % grid, `${pin.ref}`).toBe(0);
    expect(pin.y % grid, `${pin.ref}`).toBe(0);
  }

  for (const path of connections(scene)) {
    expect(path.points.length).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < path.points.length; i++) {
      const p = path.points[i]!;
      // All path points on the grid.
      expect(p.x % grid, `${path.ref} x`).toBe(0);
      expect(p.y % grid, `${path.ref} y`).toBe(0);
      if (i === 0) continue;
      const prev = path.points[i - 1]!;
      // Orthogonal segments only.
      expect(prev.x === p.x || prev.y === p.y, `${path.ref} not orthogonal`).toBe(true);
      // No segment runs through the inside of a component.
      for (const s of bodies) {
        const hitsX = Math.max(prev.x, p.x) > s.x && Math.min(prev.x, p.x) < s.x + s.width;
        const hitsY = Math.max(prev.y, p.y) > s.y && Math.min(prev.y, p.y) < s.y + s.height;
        const inside = prev.x === p.x
          ? p.x > s.x && p.x < s.x + s.width && hitsY
          : p.y > s.y && p.y < s.y + s.height && hitsX;
        expect(inside, `${path.ref} intersects ${s.ref}`).toBe(false);
      }
    }
  }

  // Label, count and icon sit inside the inner area of their shape (for stacks: of the front card).
  for (const s of bodies) {
    const base = shapeGeometry(s.shape, { padding, grid });
    const inner = (s.stack ? stackedGeometry(base, s.stack.layers * s.stack.offset) : base).inner(s);
    const count = scene.items.find((i): i is SceneText => i.type === "text" && i.ref === s.ref && i.className === "sa-label sa-component-count");
    expect(count !== undefined, `${s.ref}: count exactly for stacks`).toBe(s.stack !== undefined);
    if (count) expect(contains(inner, textBounds(count)), `count of ${s.ref} sticks out of the inner area`).toBe(true);
    const label = scene.items.find((i): i is SceneText => i.type === "text" && i.ref === s.ref && i.className === "sa-label sa-component-label");
    expect(label, `${s.ref} without a label`).toBeDefined();
    expect(contains(inner, textBounds(label!)), `label of ${s.ref} sticks out of the inner area`).toBe(true);
    const icon = scene.items.find((i) => i.type === "icon" && i.ref === s.ref);
    if (icon?.type === "icon") {
      expect(contains(inner, { x: icon.x, y: icon.y, width: icon.size, height: icon.size }), `icon of ${s.ref}`).toBe(true);
    }
  }

  // Everything sits on the canvas.
  for (const s of bodies) expect(contains({ x: 0, y: 0, width: scene.width, height: scene.height }, s)).toBe(true);
}

describe("layout properties", () => {
  for (const example of examples()) {
    for (const direction of ["LR", "TB"] as const) {
      for (const theme of Object.values(themes)) {
        it(`${example.name} · ${direction} · ${theme.name}`, () => {
          const scene = render(withDirection(example.source, direction), theme);
          checkProperties(scene, theme.spacing.grid, theme.component.padding);
        });
      }
    }
  }
});

describe("determinism and stability", () => {
  for (const example of examples()) {
    it(`${example.name}: identical input yields an identical scene`, () => {
      expect(JSON.stringify(render(example.source))).toBe(JSON.stringify(render(example.source)));
    });

    it(`${example.name}: an unconnected component at the end shifts nothing`, () => {
      const before = render(example.source);
      const after = render(appendUnconnected(example.source));
      const geometry = (scene: SceneGraph) =>
        scene.items
          .filter((i) => i.type === "shape" || i.type === "path" || (i.type === "marker" && i.shape === "pin"))
          .filter((i) => !i.ref?.includes("stability_probe"))
          .map((i) => JSON.stringify(i));
      expect(after.items.some((i) => i.ref === "component:stability_probe")).toBe(true);
      expect(geometry(after)).toEqual(geometry(before));
    });
  }
});
