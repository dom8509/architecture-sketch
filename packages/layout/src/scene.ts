import type { IconDef, Shape } from "@sysarch/core";
import type { TextStyle } from "@sysarch/themes";

/**
 * Renderer-neutrale, vollständig ausgerechnete Szene: absolute Koordinaten, aufgelöste
 * Farben, gemessene und umbrochene Texte. Ein Renderer trifft keine Entscheidungen mehr.
 */
export interface SceneGraph {
  width: number;
  height: number;
  background: string;
  /** Architekturtitel für `<title>`. */
  title: string;
  /** Alle verwendeten Icons, nach Name sortiert. */
  icons: IconDef[];
  /** Zeichenreihenfolge: Zonen → Systeme → Verbindungen → Komponenten → Icons → Pins → Labels. */
  items: SceneItem[];
}

export type SceneItem = SceneRect | SceneShape | ScenePath | SceneText | SceneMarker | SceneIcon;

export interface SceneBase {
  /** Rückverweis für Hit-Testing und Quellsprung, z. B. "component:mcu", "pin:mcu.CAN_TX". */
  ref?: string;
  /** Stabile CSS-Klasse im SVG, z. B. "sa-component sa-cat-power". */
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

/** Komponentenkörper; x/y/width/height ist die Hülle, die Kontur ergibt sich aus `shape`. */
export interface SceneShape extends SceneBase, Rect {
  type: "shape";
  shape: Shape;
  /** "rounded": Eckenradius; "cylinder": halbe Ellipsenhöhe; sonst 0. */
  radius: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  /**
   * Mehrfachelement: `layers` hintere Karten, je `offset` nach oben rechts versetzt. Die vordere
   * Karte ist `stackFront(hülle, layers × offset)`; der Renderer zeichnet hinten zuerst.
   */
  stack?: { layers: number; offset: number };
}

export interface SceneIcon extends SceneBase {
  type: "icon";
  /** Verweis auf `SceneGraph.icons`, im SVG als `<symbol>`. */
  name: string;
  x: number;
  y: number;
  size: number;
  color: string;
  /** Strichstärke im 24×24-Raster des Icons. */
  strokeWidth: number;
}

export interface ScenePath extends SceneBase {
  type: "path";
  /** Nur orthogonale Segmente: aufeinanderfolgende Punkte teilen x oder y. */
  points: Point[];
  stroke: string;
  strokeWidth: number;
  dash?: number[];
  double?: boolean;
  /**
   * Kreuzungen, an denen dieser Pfad die kreuzende Leitung mit einem Bogen überspringt.
   * Liegen immer auf waagerechten Segmenten; der Bogen wölbt sich nach oben.
   */
  hops?: Point[];
  hopRadius?: number;
  /** Füllfarbe zwischen den Linien einer Doppellinie (Hintergrund). */
  gap?: string;
}

export interface SceneText extends SceneBase {
  type: "text";
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
  baseline: "top" | "middle" | "bottom";
  /** Umbrochen bereits im Layout. */
  lines: string[];
  style: TextStyle & { fontFamily: string };
  /** Zeilenhöhe in px. */
  lineHeight: number;
  /** Abstand Zeilenoberkante → Grundlinie in px. */
  ascent: number;
  /** Gemessene Breite der breitesten Zeile in px. */
  width: number;
  /** Optionaler Hintergrund, damit Verbindungslabels Linien nicht überlagern. */
  halo?: string;
}

export interface SceneMarker extends SceneBase {
  type: "marker";
  shape: "arrow" | "ground" | "pin" | "junction";
  x: number;
  y: number;
  /** Richtung, in die der Marker zeigt: 0 = +x, 90 = +y, 180 = −x, 270 = −y. */
  angle: 0 | 90 | 180 | 270;
  size: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
}

/** Begrenzungsrechteck eines Texts. */
export function textBounds(text: SceneText): Rect {
  const height = text.lines.length * text.lineHeight;
  const x = text.anchor === "start" ? text.x : text.anchor === "middle" ? text.x - text.width / 2 : text.x - text.width;
  const y = text.baseline === "top" ? text.y : text.baseline === "middle" ? text.y - height / 2 : text.y - height;
  return { x, y, width: text.width, height };
}
