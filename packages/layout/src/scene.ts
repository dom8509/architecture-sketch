import type { IconDef, Shape } from "@sysarch/core";
import type { TextStyle } from "@sysarch/themes";

/**
 * Renderer-neutral, fully computed scene: absolute coordinates, resolved colors, measured
 * and wrapped text. A renderer makes no decisions of its own.
 */
export interface SceneGraph {
  width: number;
  height: number;
  background: string;
  /** Architecture title for `<title>`. */
  title: string;
  /** All icons in use, sorted by name. */
  icons: IconDef[];
  /** Draw order: zones → systems → connections → components → icons → pins → labels. */
  items: SceneItem[];
}

export type SceneItem = SceneRect | SceneShape | ScenePath | SceneText | SceneMarker | SceneIcon;

export interface SceneBase {
  /** Back reference for hit testing and jump-to-source, e.g. "component:mcu", "pin:mcu.CAN_TX". */
  ref?: string;
  /** Stable CSS class in the SVG, e.g. "sa-component sa-cat-power". */
  className?: string;
}

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SceneRect extends SceneBase, Rect {
  type: "rect";
  radius: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  dash?: number[];
}

/** Component body; x/y/width/height is the hull, the contour follows from `shape`. */
export interface SceneShape extends SceneBase, Rect {
  type: "shape";
  shape: Shape;
  /** "rounded": corner radius; "cylinder": half the ellipse height; otherwise 0. */
  radius: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  /** Dashed contour — `external` components. */
  dash?: number[];
  /**
   * Multiple element: `layers` cards behind, each offset by `offset` towards the upper right.
   * The front card is `stackFront(hull, layers × offset)`; the renderer draws back to front.
   */
  stack?: { layers: number; offset: number };
}

export interface SceneIcon extends SceneBase {
  type: "icon";
  /** Reference into `SceneGraph.icons`, a `<symbol>` in the SVG. */
  name: string;
  x: number;
  y: number;
  size: number;
  color: string;
  /** Stroke width in the icon's 24×24 grid. */
  strokeWidth: number;
}

export interface ScenePath extends SceneBase {
  type: "path";
  /** Orthogonal segments only: consecutive points share x or y. */
  points: Point[];
  stroke: string;
  strokeWidth: number;
  dash?: number[];
  double?: boolean;
  /**
   * Crossings where this path hops over the crossing line with an arc. Always on horizontal
   * segments; the arc bulges upwards.
   */
  hops?: Point[];
  hopRadius?: number;
  /** Fill color between the two strokes of a double line (background). */
  gap?: string;
}

export interface SceneText extends SceneBase {
  type: "text";
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
  baseline: "top" | "middle" | "bottom";
  /** Already wrapped by the layout. */
  lines: string[];
  style: TextStyle & { fontFamily: string };
  /** Line height in px. */
  lineHeight: number;
  /** Distance from the top of the line to the baseline, in px. */
  ascent: number;
  /** Measured width of the widest line, in px. */
  width: number;
  /** Optional backdrop so that connection labels do not sit on top of lines. */
  halo?: string;
}

export interface SceneMarker extends SceneBase {
  type: "marker";
  shape: "arrow" | "ground" | "pin" | "junction";
  x: number;
  y: number;
  /** Direction the marker points in: 0 = +x, 90 = +y, 180 = −x, 270 = −y. */
  angle: 0 | 90 | 180 | 270;
  size: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
}

/** Bounding box of a text. */
export function textBounds(text: SceneText): Rect {
  const height = text.lines.length * text.lineHeight;
  const x = text.anchor === "start" ? text.x : text.anchor === "middle" ? text.x - text.width / 2 : text.x - text.width;
  const y = text.baseline === "top" ? text.y : text.baseline === "middle" ? text.y - height / 2 : text.y - height;
  return { x, y, width: text.width, height };
}
