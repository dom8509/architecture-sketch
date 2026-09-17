import type { Component, Side } from "@sysarch/core";
import { LINE_HEIGHT, measureLine, measureText, wrapText, type FontMetrics, type TextStyle, type Theme } from "@sysarch/themes";
import { shapeGeometry, type ShapeGeometry } from "./shapes.js";

/** Pin relativ zur Hülle: `offset` läuft entlang der Seite (y für links/rechts, x für oben/unten). */
export interface PinBox {
  name: string;
  side: Side;
  offset: number;
  labelWidth: number;
}

export interface TextBlock {
  /** Relativ zur Hülle. */
  x: number;
  y: number;
  lines: string[];
  width: number;
  height: number;
  style: TextStyle;
}

/** Größe und innerer Aufbau einer Komponente, alles relativ zur Hülle (0, 0). */
export interface ComponentBox {
  width: number;
  height: number;
  geometry: ShapeGeometry;
  /** Icon-Quadrat, relativ zur Hülle. */
  icon?: { x: number; y: number; size: number };
  label: TextBlock;
  pins: PinBox[];
}

const ceilTo = (value: number, grid: number) => Math.ceil(value / grid - 1e-9) * grid;
const roundTo = (value: number, grid: number) => Math.round(value / grid) * grid;

export function sizeComponent(component: Component, theme: Theme, metrics: FontMetrics): ComponentBox {
  const { grid, pinPitch } = theme.spacing;
  const { padding } = theme.component;
  const geometry = shapeGeometry(component.shape, { padding, grid });

  // ── Kopf: Icon + Label ──────────────────────────────────────
  const labelStyle = component.importance === "primary" ? theme.typography.componentPrimary : theme.typography.component;
  // Kreise wachsen in beide Richtungen; ihre Labels brechen schon ab der Mindestbreite um.
  const maxLabelWidth = (component.shape === "circle" ? 1 : 3) * theme.component.minWidth[component.size] - 2 * padding;
  const lines = wrapText(metrics, component.label, labelStyle.size, labelStyle.weight, maxLabelWidth);
  const labelBox = measureText(metrics, lines, labelStyle.size, labelStyle.weight);
  const iconSize = component.icon ? theme.icon.size[component.size] : 0;
  const iconGap = component.icon && labelBox.width > 0 ? theme.icon.gap : 0;
  const stacked = component.size === "small" || component.shape === "circle";
  const header = stacked
    ? { width: Math.max(iconSize, labelBox.width), height: iconSize + iconGap + labelBox.height }
    : { width: iconSize + iconGap + labelBox.width, height: Math.max(iconSize, labelBox.height) };

  // ── Pins ─────────────────────────────────────────────────────
  const pinStyle = theme.typography.pin;
  const pinLabelHeight = pinStyle.size * LINE_HEIGHT;
  const bySide: Record<Side, { name: string; width: number }[]> = { left: [], right: [], top: [], bottom: [] };
  for (const pin of component.pins) {
    bySide[pin.side].push({ name: pin.name, width: measureLine(metrics, pin.label, pinStyle.size, pinStyle.weight) });
  }
  const maxWidth = (pins: { width: number }[]) => pins.reduce((m, p) => Math.max(m, p.width), 0);
  const { left, right, top, bottom } = bySide;
  const rows = Math.max(left.length, right.length);
  const sideWidth = maxWidth(left) + maxWidth(right) + (left.length && right.length ? grid : 0);
  const topPitch = ceilTo(Math.max(pinPitch, maxWidth(top) + grid / 2), grid);
  const bottomPitch = ceilTo(Math.max(pinPitch, maxWidth(bottom) + grid / 2), grid);
  const topBand = top.length ? pinLabelHeight + 2 : 0;
  const bottomBand = bottom.length ? pinLabelHeight + 2 : 0;
  const rowGap = rows ? grid : 0;

  const content = {
    width: Math.max(header.width, sideWidth, top.length * topPitch, bottom.length * bottomPitch),
    height: topBand + header.height + rowGap + rows * pinPitch + bottomBand,
  };

  // ── Hülle ────────────────────────────────────────────────────
  const hull = geometry.hullFor(content);
  let width = ceilTo(Math.max(hull.width, theme.component.minWidth[component.size]), grid);
  let height = ceilTo(Math.max(hull.height, theme.component.minHeight[component.size]), grid);
  if (component.shape === "circle") width = height = Math.max(width, height);
  // Mindestgrößen und Rundung verändern bei manchen Formen den Innenbereich (Sechseck-Spitzen).
  let inner = geometry.inner({ x: 0, y: 0, width, height });
  while (inner.width < content.width - 1e-9 || inner.height < content.height - 1e-9) {
    if (inner.width < content.width - 1e-9) width += grid;
    if (inner.height < content.height - 1e-9) height += grid;
    if (component.shape === "circle") width = height = Math.max(width, height);
    inner = geometry.inner({ x: 0, y: 0, width, height });
  }

  // ── Pin-Positionen ───────────────────────────────────────────
  const pins: PinBox[] = [];
  const regionTop = inner.y + topBand + header.height + rowGap / 2;
  const regionBottom = inner.y + inner.height - bottomBand;
  for (const side of ["left", "right"] as const) {
    const list = bySide[side];
    if (list.length === 0) continue;
    const center = (regionTop + regionBottom) / 2;
    let first = roundTo(center - ((list.length - 1) / 2) * pinPitch, grid);
    while (first - pinLabelHeight / 2 < regionTop - 1e-9 && first + (list.length - 1) * pinPitch + grid <= height - grid) first += grid;
    first = Math.max(first, grid);
    list.forEach((pin, k) => pins.push({ name: pin.name, side, offset: first + k * pinPitch, labelWidth: pin.width }));
  }
  for (const [side, pitch] of [["top", topPitch], ["bottom", bottomPitch]] as const) {
    const list = bySide[side];
    if (list.length === 0) continue;
    let first = roundTo(width / 2 - ((list.length - 1) / 2) * pitch, grid);
    first = Math.max(first, grid);
    list.forEach((pin, k) => pins.push({ name: pin.name, side, offset: first + k * pitch, labelWidth: pin.width }));
  }
  // Darstellungsreihenfolge = Modellreihenfolge.
  const order = new Map(component.pins.map((p, i) => [p.name, i]));
  pins.sort((a, b) => order.get(a.name)! - order.get(b.name)!);

  // ── Kopf platzieren ──────────────────────────────────────────
  const headerX = inner.x + (inner.width - header.width) / 2;
  const headerY = rows
    ? inner.y + topBand
    : inner.y + topBand + (inner.height - topBand - bottomBand - header.height) / 2;
  let icon: ComponentBox["icon"];
  let label: TextBlock;
  if (stacked) {
    if (component.icon) icon = { x: inner.x + (inner.width - iconSize) / 2, y: headerY, size: iconSize };
    label = {
      x: inner.x + (inner.width - labelBox.width) / 2,
      y: headerY + iconSize + iconGap,
      lines, width: labelBox.width, height: labelBox.height, style: labelStyle,
    };
  } else {
    if (component.icon) icon = { x: headerX, y: headerY + (header.height - iconSize) / 2, size: iconSize };
    label = {
      x: headerX + iconSize + iconGap,
      y: headerY + (header.height - labelBox.height) / 2,
      lines, width: labelBox.width, height: labelBox.height, style: labelStyle,
    };
  }

  return { width, height, geometry, ...(icon && { icon }), label, pins };
}
