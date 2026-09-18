import type { Component, Side } from "@sysarch/core";
import { LINE_HEIGHT, measureLine, measureText, wrapText, type FontMetrics, type TextStyle, type Theme } from "@sysarch/themes";
import { shapeGeometry, stackedGeometry, type ShapeGeometry } from "./shapes.js";

/** Pin relative to the hull: `offset` runs along the side (y for left/right, x for top/bottom). */
export interface PinBox {
  name: string;
  side: Side;
  offset: number;
  labelWidth: number;
}

export interface TextBlock {
  /** Relative to the hull. */
  x: number;
  y: number;
  lines: string[];
  width: number;
  height: number;
  style: TextStyle;
}

/** Size and inner structure of a component, all relative to the hull (0, 0). */
export interface ComponentBox {
  width: number;
  height: number;
  geometry: ShapeGeometry;
  /** Icon square, relative to the hull. */
  icon?: { x: number; y: number; size: number };
  label: TextBlock;
  /** Count for multiple elements ("×4"), to the right of the first label line. */
  count?: TextBlock;
  /** Cards behind for multiple elements; the front card is smaller by `layers × offset`. */
  stack?: { layers: number; offset: number };
  pins: PinBox[];
}

const ceilTo = (value: number, grid: number) => Math.ceil(value / grid - 1e-9) * grid;
const roundTo = (value: number, grid: number) => Math.round(value / grid) * grid;

export interface SizeOptions {
  /** Minimum hull size, e.g. for components spanning several grid cells. */
  width?: number;
  height?: number;
  /** Distance between neighbouring pins; default `theme.spacing.pinPitch`. */
  pitch?: number;
}

export function sizeComponent(
  component: Component,
  theme: Theme,
  metrics: FontMetrics,
  stretch: SizeOptions = {},
): ComponentBox {
  const { grid } = theme.spacing;
  const pinPitch = stretch.pitch ?? theme.spacing.pinPitch;
  const { padding } = theme.component;
  const stack = component.count > 1 ? { layers: Math.min(component.count - 1, 2), offset: 0 } : undefined;
  const depth = stack ? grid / 2 : 0;
  if (stack) stack.offset = depth / stack.layers;
  const base = shapeGeometry(component.shape, { padding, grid });
  const geometry = stack ? stackedGeometry(base, depth) : base;

  // ── Header: icon + label ────────────────────────────────────
  const labelStyle = component.importance === "primary" ? theme.typography.componentPrimary : theme.typography.component;
  // Circles grow in both directions; their labels wrap from the minimum width on.
  const maxLabelWidth = (component.shape === "circle" ? 1 : 3) * theme.component.minWidth[component.size] - 2 * padding;
  const lines = wrapText(metrics, component.label, labelStyle.size, labelStyle.weight, maxLabelWidth);
  const labelBox = measureText(metrics, lines, labelStyle.size, labelStyle.weight);
  const iconSize = component.icon ? theme.icon.size[component.size] : 0;
  const iconGap = component.icon && labelBox.width > 0 ? theme.icon.gap : 0;
  const countStyle: TextStyle = { ...labelStyle, weight: 400 };
  const countText = stack ? `×${component.count}` : "";
  const countWidth = stack ? measureLine(metrics, countText, countStyle.size, countStyle.weight) : 0;
  const countGap = stack ? theme.icon.gap : 0;
  const titleWidth = labelBox.width + countGap + countWidth;
  const stacked = component.size === "small" || component.shape === "circle";
  const header = stacked
    ? { width: Math.max(iconSize, titleWidth), height: iconSize + iconGap + labelBox.height }
    : { width: iconSize + iconGap + titleWidth, height: Math.max(iconSize, labelBox.height) };

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

  // ── Hull ─────────────────────────────────────────────────────
  const hull = geometry.hullFor(content);
  let width = ceilTo(Math.max(hull.width, theme.component.minWidth[component.size], stretch.width ?? 0), grid);
  let height = ceilTo(Math.max(hull.height, theme.component.minHeight[component.size], stretch.height ?? 0), grid);
  if (component.shape === "circle") width = height = Math.max(width, height);
  // Minimum sizes and rounding change the inner area for some shapes (hexagon tips).
  let inner = geometry.inner({ x: 0, y: 0, width, height });
  while (inner.width < content.width - 1e-9 || inner.height < content.height - 1e-9) {
    if (inner.width < content.width - 1e-9) width += grid;
    if (inner.height < content.height - 1e-9) height += grid;
    if (component.shape === "circle") width = height = Math.max(width, height);
    inner = geometry.inner({ x: 0, y: 0, width, height });
  }

  // ── Pin positions ────────────────────────────────────────────
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
    let first = roundTo((width - depth) / 2 - ((list.length - 1) / 2) * pitch, grid);
    first = Math.max(first, grid);
    list.forEach((pin, k) => pins.push({ name: pin.name, side, offset: first + k * pitch, labelWidth: pin.width }));
  }
  // Rendering order = model order.
  const order = new Map(component.pins.map((p, i) => [p.name, i]));
  pins.sort((a, b) => order.get(a.name)! - order.get(b.name)!);

  // ── Place the header ─────────────────────────────────────────
  const headerX = inner.x + (inner.width - header.width) / 2;
  const headerY = rows
    ? inner.y + topBand
    : inner.y + topBand + (inner.height - topBand - bottomBand - header.height) / 2;
  let icon: ComponentBox["icon"];
  let label: TextBlock;
  if (stacked) {
    if (component.icon) icon = { x: inner.x + (inner.width - iconSize) / 2, y: headerY, size: iconSize };
    label = {
      x: inner.x + (inner.width - titleWidth) / 2,
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

  const count: TextBlock | undefined = stack && {
    x: label.x + labelBox.width + countGap,
    y: label.y,
    lines: [countText],
    width: countWidth,
    height: countStyle.size * LINE_HEIGHT,
    style: countStyle,
  };
  return { width, height, geometry, ...(icon && { icon }), label, ...(count && { count, stack }), pins };
}
