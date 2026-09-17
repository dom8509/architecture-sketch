import type { Shape, Side } from "@sysarch/core";
import type { Point, Rect } from "./scene.js";

export interface Size2 {
  width: number;
  height: number;
}

/** Geometrie einer Form — gemeinsam genutzt von Layout und Renderer. */
export interface ShapeGeometry {
  /** Innenbereich für Icon + Label, relativ zur Hülle. */
  inner(hull: Rect): Rect;
  /** Kleinste Hülle, deren Innenbereich `content` aufnimmt. */
  hullFor(content: Size2): Size2;
  /** Punkt auf der Kontur für einen Pin an Seite `side` und Querkoordinate `t` (absolut). */
  contour(hull: Rect, side: Side, t: number): Point;
}

export interface ShapeParams {
  padding: number;
  grid: number;
}

const inset = (r: Rect, dx: number, dy: number): Rect => ({
  x: r.x + dx, y: r.y + dy, width: Math.max(0, r.width - 2 * dx), height: Math.max(0, r.height - 2 * dy),
});

/** Punkt auf dem Hüllrechteck. */
function edge(hull: Rect, side: Side, t: number): Point {
  switch (side) {
    case "left": return { x: hull.x, y: t };
    case "right": return { x: hull.x + hull.width, y: t };
    case "top": return { x: t, y: hull.y };
    case "bottom": return { x: t, y: hull.y + hull.height };
  }
}

function box(p: ShapeParams): ShapeGeometry {
  return {
    inner: (hull) => inset(hull, p.padding, p.padding),
    hullFor: (c) => ({ width: c.width + 2 * p.padding, height: c.height + 2 * p.padding }),
    contour: edge,
  };
}

const SQRT1_2 = Math.SQRT1_2;

function circle(p: ShapeParams): ShapeGeometry {
  return {
    inner: (hull) => {
      const d = Math.min(hull.width, hull.height);
      const side = d * SQRT1_2 - p.padding;
      return {
        x: hull.x + (hull.width - side) / 2,
        y: hull.y + (hull.height - side) / 2,
        width: side,
        height: side,
      };
    },
    hullFor: (c) => {
      const d = (Math.max(c.width, c.height) + p.padding) / SQRT1_2;
      return { width: d, height: d };
    },
    contour: (hull, side, t) => {
      const r = Math.min(hull.width, hull.height) / 2;
      const cx = hull.x + hull.width / 2;
      const cy = hull.y + hull.height / 2;
      const along = side === "left" || side === "right" ? t - cy : t - cx;
      const depth = Math.sqrt(Math.max(0, r * r - along * along));
      switch (side) {
        case "left": return { x: cx - depth, y: t };
        case "right": return { x: cx + depth, y: t };
        case "top": return { x: t, y: cy - depth };
        case "bottom": return { x: t, y: cy + depth };
      }
    },
  };
}

/** Spitzen links/rechts, Spitzentiefe = ¼ Höhe. */
function hexagon(p: ShapeParams): ShapeGeometry {
  return {
    inner: (hull) => {
      const tip = hull.height / 4;
      return inset({ x: hull.x + tip, y: hull.y, width: hull.width - 2 * tip, height: hull.height }, p.padding, p.padding);
    },
    hullFor: (c) => {
      const height = c.height + 2 * p.padding;
      return { width: c.width + 2 * p.padding + height / 2, height };
    },
    contour: (hull, side, t) => {
      if (side === "top" || side === "bottom") return edge(hull, side, t);
      const tip = hull.height / 4;
      const cy = hull.y + hull.height / 2;
      const depth = (tip * Math.abs(t - cy)) / (hull.height / 2);
      return side === "left" ? { x: hull.x + depth, y: t } : { x: hull.x + hull.width - depth, y: t };
    },
  };
}

/** Ellipsenhöhe = 1 Grid-Einheit. */
function cylinder(p: ShapeParams): ShapeGeometry {
  const ry = p.grid / 2;
  return {
    inner: (hull) => ({
      x: hull.x + p.padding,
      y: hull.y + 2 * ry + p.padding / 2,
      width: Math.max(0, hull.width - 2 * p.padding),
      height: Math.max(0, hull.height - 3 * ry - p.padding),
    }),
    hullFor: (c) => ({ width: c.width + 2 * p.padding, height: c.height + 3 * ry + p.padding }),
    contour: (hull, side, t) => {
      if (side === "left" || side === "right") return edge(hull, side, t);
      const rx = hull.width / 2;
      const cx = hull.x + rx;
      const u = (t - cx) / rx;
      const depth = ry * Math.sqrt(Math.max(0, 1 - u * u));
      return side === "top"
        ? { x: t, y: hull.y + ry - depth }
        : { x: t, y: hull.y + hull.height - ry + depth };
    },
  };
}

/** Vordere Karte eines Stapels: unten links in der Hülle, `depth` kleiner. */
export function stackFront(hull: Rect, depth: number): Rect {
  return { x: hull.x, y: hull.y + depth, width: hull.width - depth, height: hull.height - depth };
}

/**
 * Gestapelte Mehrfachelemente (`count`): Die hinteren Karten liegen nach oben rechts versetzt
 * innerhalb der Hülle. Innenbereich und Kontur gehören zur vorderen Karte; Pins oben und
 * rechts erhalten wie bei Kreisen einen Stummel bis zur Hülle.
 */
export function stackedGeometry(base: ShapeGeometry, depth: number): ShapeGeometry {
  return {
    inner: (hull) => base.inner(stackFront(hull, depth)),
    hullFor: (c) => {
      const front = base.hullFor(c);
      return { width: front.width + depth, height: front.height + depth };
    },
    contour: (hull, side, t) => base.contour(stackFront(hull, depth), side, t),
  };
}

export function shapeGeometry(shape: Shape, params: ShapeParams): ShapeGeometry {
  switch (shape) {
    case "rounded":
    case "rect": return box(params);
    case "circle": return circle(params);
    case "hexagon": return hexagon(params);
    case "cylinder": return cylinder(params);
  }
}
