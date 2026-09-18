import {
  SIGNAL_GROUPS, stackIdentical, standardLibrary,
  type ArchitectureModel, type IconDef, type Side,
} from "@sysarch/core";
import { ascent, INTER_METRICS, LINE_HEIGHT, measureLine, type FontMetrics, type TextStyle, type Theme } from "@sysarch/themes";
import { applyOverrides, Axes, buildNodes, rankGap, type LEdge, type LNode } from "./graph.js";
import { placeLabel } from "./labels.js";
import { orderLayers } from "./order.js";
import { placeNodes } from "./place.js";
import { alignSpanPorts, assignBodyPorts } from "./ports.js";
import { assignRanks } from "./rank.js";
import { portPoint, routeEdges } from "./route.js";
import { textBounds, type Point, type Rect, type SceneGraph, type SceneItem, type SceneMarker, type ScenePath, type SceneText } from "./scene.js";
import { sizeComponent, type ComponentBox } from "./size.js";

export * from "./scene.js";
export { shapeGeometry, stackFront, stackedGeometry, type ShapeGeometry, type ShapeParams, type Size2 } from "./shapes.js";

export interface LayoutOptions {
  /** Icons for `SceneGraph.icons`; defaults to the icons of the standard library. */
  icons?: ReadonlyMap<string, IconDef>;
}

/** ArchitectureModel → SceneGraph. Pure function, deterministic. */
export function layout(
  source: ArchitectureModel,
  theme: Theme,
  metrics: FontMetrics = INTER_METRICS,
  options: LayoutOptions = {},
): SceneGraph {
  const model = withVisiblePins(stackIdentical(source));
  const { grid } = theme.spacing;
  const axes = new Axes(model.direction);
  const font = theme.typography.fontFamily;

  // ── Sizes ────────────────────────────────────────────────────
  const boxes = new Map<string, ComponentBox>();
  for (const c of model.components.values()) boxes.set(c.id, sizeComponent(c, theme, metrics));

  const { nodes, zones } = buildNodes(model, boxes);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  applyOverrides(model, byId);

  const edges: LEdge[] = model.connections.map((connection, index) => {
    const source = byId.get(connection.source.component)!;
    const target = byId.get(connection.target.component)!;
    const port = (node: LNode, pin: string | undefined) =>
      (pin !== undefined ? node.pinPorts.get(pin) : undefined) ?? { side: "right" as Side, offset: 0 };
    return {
      index,
      connection,
      source,
      target,
      sourcePort: port(source, connection.source.pin),
      targetPort: port(target, connection.target.pin),
      feedback: false,
      weight: connection.direction === "forward" ? 1 : 0.5,
    };
  });

  // ── Ranks, order, ports, coordinates ─────────────────────────
  assignRanks(nodes, edges, zones.length);
  const layers = orderLayers(nodes, edges, axes);
  assignBodyPorts(edges, axes, grid);
  const connectionStyle = style(theme.typography.connection, font);
  const labelSpace: number[] = [];
  for (const e of edges) {
    const label = e.connection.label;
    if (!label || e.feedback) continue;
    const gap = rankGap(e.source, e.target);
    if (gap === undefined || gap.width !== 1) continue;
    const lines = label.split("\n");
    const along = model.direction === "LR"
      ? Math.max(...lines.map((l) => measureLine(metrics, l, connectionStyle.size, connectionStyle.weight)))
      : lines.length * connectionStyle.size * LINE_HEIGHT;
    const r = gap.after;
    labelSpace[r] = Math.max(labelSpace[r] ?? 0, along + 2 * theme.markers.arrow + 2 * grid);
  }
  // Nodes spanning several grid cells: stretch the hull, pins keep their port objects.
  const stretched = new Map<LNode, { main?: number; cross?: number }>();
  const stretch = (n: LNode, main: number | undefined, cross: number | undefined) => {
    const current = { ...stretched.get(n), ...(main !== undefined && { main }), ...(cross !== undefined && { cross }) };
    stretched.set(n, current);
    n.box = sizeComponent(n.component, theme, metrics, model.direction === "LR"
      ? { width: current.main, height: current.cross }
      : { width: current.cross, height: current.main });
    for (const pin of n.box.pins) Object.assign(n.pinPorts.get(pin.name)!, { side: pin.side, offset: pin.offset });
  };
  const natural = (n: LNode) => boxes.get(n.id)!;
  const frames = placeNodes({ model, theme, axes, nodes, edges, layers, zones, labelSpace, stretch, natural });

  // ── Group labels ─────────────────────────────────────────────
  const groupStyle = style(theme.typography.group, font);
  const groupLabels: SceneText[] = [];
  for (const frame of frames) {
    if (!frame.group.label) continue;
    const pad = frame.depth === 0 ? theme.spacing.groupPadding : theme.spacing.groupPadding / 2;
    groupLabels.push(text(metrics, {
      ref: `${frame.group.type}:${frame.group.id}`,
      className: `sa-label sa-${frame.group.type}-label`,
      x: frame.rect.x + pad,
      y: frame.rect.y + pad / 2,
      anchor: "start",
      baseline: "top",
      lines: [frame.group.label],
      style: groupStyle,
    }));
  }

  alignSpanPorts(edges, axes, grid, groupLabels.map(textBounds));

  // ── Routing ──────────────────────────────────────────────────
  const routes = routeEdges({
    nodes,
    edges,
    frames,
    groupLabels: groupLabels.map(textBounds),
    grid,
    crossStartDirection: model.direction === "LR" ? 3 : 2,
  });

  // ── Szene ────────────────────────────────────────────────────
  const zoneItems: SceneItem[] = [];
  const systemItems: SceneItem[] = [];
  for (const frame of frames) {
    if (frame.group.type === "zone") {
      zoneItems.push({
        type: "rect", ref: `zone:${frame.group.id}`, className: "sa-zone", ...frame.rect,
        radius: 0, fill: theme.zone.fill, stroke: theme.zone.border, strokeWidth: 1,
      });
    } else {
      systemItems.push({
        type: "rect", ref: `system:${frame.group.id}`, className: "sa-system", ...frame.rect,
        radius: theme.system.radius, fill: "none", stroke: theme.system.border, strokeWidth: theme.system.width,
        ...(theme.system.dash && { dash: theme.system.dash }),
      });
    }
  }

  const connectionItems: SceneItem[] = [];
  const connectionLabels: SceneText[] = [];
  const componentItems: SceneItem[] = [];
  const iconItems: SceneItem[] = [];
  const pinItems: SceneItem[] = [];
  const labelItems: SceneText[] = [];
  const obstacles: Rect[] = [...nodes.map(hull), ...groupLabels.map(textBounds)];
  const usedIcons = new Set<string>();

  for (const n of nodes) {
    const c = n.component;
    const colors = theme.categories[c.category];
    const rect = hull(n);
    componentItems.push({
      type: "shape",
      ref: `component:${c.id}`,
      className: `sa-component sa-shape-${c.shape} sa-cat-${c.category} sa-importance-${c.importance}`,
      shape: c.shape,
      ...rect,
      radius: c.shape === "rounded" ? theme.component.radius : c.shape === "cylinder" ? grid / 2 : 0,
      fill: colors.fill,
      stroke: colors.border,
      strokeWidth: theme.component.borderWidth[c.importance],
      ...(n.box.stack && { stack: n.box.stack }),
    });

    const box = n.box;
    if (box.icon && c.icon) {
      usedIcons.add(c.icon);
      iconItems.push({
        type: "icon", ref: `component:${c.id}`, className: "sa-icon", name: c.icon,
        x: n.x + box.icon.x, y: n.y + box.icon.y, size: box.icon.size,
        color: colors.text, strokeWidth: theme.icon.strokeWidth,
      });
    }
    labelItems.push(text(metrics, {
      ref: `component:${c.id}`,
      className: "sa-label sa-component-label",
      x: n.x + box.label.x + box.label.width / 2,
      y: n.y + box.label.y,
      anchor: "middle",
      baseline: "top",
      lines: box.label.lines,
      style: style({ ...box.label.style, color: colors.text }, font),
    }));
    if (box.count) {
      labelItems.push(text(metrics, {
        ref: `component:${c.id}`,
        className: "sa-label sa-component-count",
        x: n.x + box.count.x,
        y: n.y + box.count.y,
        anchor: "start",
        baseline: "top",
        lines: box.count.lines,
        style: style({ ...box.count.style, color: colors.text }, font),
      }));
    }

    const pinStyle = style({ ...theme.typography.pin, color: colors.text }, font);
    const inner = box.geometry.inner(rect);
    for (const pin of c.pins) {
      const port = n.pinPorts.get(pin.name)!;
      const p = portPoint(n, port);
      const contour = box.geometry.contour(rect, port.side, port.side === "left" || port.side === "right" ? p.y : p.x);
      if (Math.abs(contour.x - p.x) + Math.abs(contour.y - p.y) > 0.5) {
        componentItems.push({
          type: "path", ref: `pin:${c.id}.${pin.name}`, className: "sa-stub",
          points: [contour, p], stroke: colors.border, strokeWidth: theme.component.borderWidth[c.importance],
        });
      }
      const group = SIGNAL_GROUPS[pin.kind];
      pinItems.push({
        type: "marker", ref: `pin:${c.id}.${pin.name}`, className: `sa-pin sa-group-${group} sa-kind-${pin.kind}`,
        shape: "pin", x: p.x, y: p.y, angle: angleOf(port.side), size: theme.markers.pin,
        fill: colors.border, stroke: theme.canvas.background, strokeWidth: 1,
      });
      const [x, y, anchor, baseline] = pinLabelAnchor(port.side, p, inner);
      labelItems.push(text(metrics, {
        ref: `pin:${c.id}.${pin.name}`, className: "sa-label sa-pin-label",
        x, y, anchor, baseline, lines: [pin.label], style: pinStyle,
      }));
    }
  }

  const placedLabels: Rect[] = [];
  for (const e of edges) {
    const c = e.connection;
    const points = routes.get(e)!;
    const group = SIGNAL_GROUPS[c.kind];
    const line = theme.lines[group];
    const className = `sa-connection sa-group-${group} sa-kind-${c.kind}`;
    connectionItems.push({
      type: "path", ref: `connection:${c.id}`, className, points,
      stroke: line.color, strokeWidth: line.width,
      ...(line.dash && { dash: line.dash }),
      ...(line.double && { double: true, gap: theme.canvas.background }),
    });

    const endMarker = c.kind === "ground" && line.endMarker !== "none" ? "ground" : line.endMarker;
    // If the connection ends at a pin, the tip sits in front of the pin marker instead of under it.
    const marker = (at: Point, from: Point, shape: "arrow" | "ground", pinned: boolean): SceneMarker => {
      const angle = direction(from, at);
      const back = pinned ? theme.markers.pin / 2 + 1 : 0;
      const [ux, uy] = angle === 0 ? [1, 0] : angle === 90 ? [0, 1] : angle === 180 ? [-1, 0] : [0, -1];
      return {
      type: "marker", ref: `connection:${c.id}`, className: `sa-marker sa-marker-${shape}`, shape,
      x: at.x - ux * back, y: at.y - uy * back, angle,
      size: shape === "arrow" ? theme.markers.arrow : theme.markers.ground,
      fill: line.color, stroke: line.color, strokeWidth: Math.min(line.width, 2),
      };
    };
    if (c.direction !== "none" && endMarker !== "none" && points.length >= 2) {
      connectionItems.push(marker(points[points.length - 1]!, points[points.length - 2]!, endMarker, e.targetPort.pin !== undefined));
      if (c.direction === "bidirectional") connectionItems.push(marker(points[0]!, points[1]!, "arrow", e.sourcePort.pin !== undefined));
    }

    if (c.label !== undefined && c.label !== "") {
      const lines = c.label.split("\n");
      const width = Math.max(...lines.map((l) => measureLine(metrics, l, connectionStyle.size, connectionStyle.weight)));
      const height = lines.length * connectionStyle.size * LINE_HEIGHT;
      const others = edges.filter((o) => o !== e).map((o) => routes.get(o)!);
      const { center } = placeLabel(
        { width: width + 6, height: height + 2, points, endClearance: theme.markers.arrow * 2 },
        [...obstacles, ...placedLabels],
        others,
        grid,
      );
      const label = text(metrics, {
        ref: `connection:${c.id}`, className: "sa-label sa-connection-label",
        x: center.x, y: center.y, anchor: "middle", baseline: "middle", lines, style: connectionStyle,
        halo: theme.canvas.background,
      });
      placedLabels.push(textBounds(label));
      connectionLabels.push(label);
    }
  }

  addHops(connectionItems, edges, theme.markers.hop);

  // ── Title, extent, shift by the padding ──────────────────────
  const titleStyle = style(theme.typography.title, font);
  const items: SceneItem[] = [
    ...zoneItems, ...systemItems, ...connectionItems, ...componentItems, ...iconItems, ...pinItems,
    ...groupLabels, ...labelItems, ...connectionLabels,
  ];
  const content = extent(items);
  const titleHeight = model.title ? Math.ceil((titleStyle.size * LINE_HEIGHT + grid) / grid) * grid : 0;
  const padding = Math.ceil(theme.canvas.padding / grid) * grid;
  const dx = padding - Math.floor(content.x / grid) * grid;
  const dy = padding + titleHeight - Math.floor(content.y / grid) * grid;
  const shifted = items.map((item) => translate(item, dx, dy));
  if (model.title) {
    shifted.push(text(metrics, {
      className: "sa-title", x: padding, y: padding, anchor: "start", baseline: "top",
      lines: [model.title], style: titleStyle,
    }));
  }
  const all = extent(shifted);
  const width = Math.ceil((all.x + all.width + padding) / grid) * grid;
  const height = Math.ceil((all.y + all.height + padding) / grid) * grid;

  const library = options.icons ?? standardLibrary().icons;
  const icons = [...usedIcons].sort().map((name) => library.get(name)).filter((i): i is IconDef => i !== undefined);

  return {
    width,
    height,
    background: theme.canvas.background,
    title: model.title,
    icons,
    items: shifted,
  };
}

// ── Helpers ────────────────────────────────────────────────────

/**
 * `pins connected|none`: components keep only the pins that are drawn. Connections to
 * hidden pins attach like body ports, because the layout no longer finds the pin.
 */
function withVisiblePins(model: ArchitectureModel): ArchitectureModel {
  if (model.pins === "all") return model;
  const connected = new Set<string>();
  for (const c of model.connections) {
    for (const end of [c.source, c.target]) if (end.pin !== undefined) connected.add(`${end.component}.${end.pin}`);
  }
  const components = new Map([...model.components].map(([id, c]) => [
    id,
    { ...c, pins: model.pins === "none" ? [] : c.pins.filter((p) => connected.has(`${id}.${p.name}`)) },
  ]));
  return { ...model, components };
}

/**
 * Hops at crossings: where a horizontal segment crosses a vertical one of another
 * connection, the horizontal one jumps over it with an arc. Connections that share an
 * endpoint belong to the same net and get no hop; crossings too close to a bend or an
 * end get none either, because there is no room for an arc.
 */
function addHops(items: SceneItem[], edges: readonly LEdge[], radius: number): void {
  const paths = items.filter((i): i is ScenePath => i.type === "path");
  const keys = new Map<string, string[]>();
  for (const e of edges) {
    const key = (node: LNode, pin: string | undefined, side: string, offset: number) =>
      pin !== undefined ? `${node.id}.${pin}` : `${node.id}#${side}${offset}`;
    keys.set(`connection:${e.connection.id}`, [
      key(e.source, e.sourcePort.pin, e.sourcePort.side, e.sourcePort.offset),
      key(e.target, e.targetPort.pin, e.targetPort.side, e.targetPort.offset),
    ]);
  }
  const segments = (p: ScenePath, horizontal: boolean) =>
    p.points.slice(1).map((b, i) => [p.points[i]!, b] as const).filter(([a, b]) => (a.y === b.y) === horizontal && (a.x !== b.x || a.y !== b.y));

  for (const path of paths) {
    const own = keys.get(path.ref ?? "") ?? [];
    const hops: Point[] = [];
    for (const [a, b] of segments(path, true)) {
      const lo = Math.min(a.x, b.x) + radius + 2;
      const hi = Math.max(a.x, b.x) - radius - 2;
      for (const other of paths) {
        if (other === path || (keys.get(other.ref ?? "") ?? []).some((k) => own.includes(k))) continue;
        for (const [c, d] of segments(other, false)) {
          const x = c.x;
          const y = a.y;
          if (x < lo || x > hi) continue;
          if (y <= Math.min(c.y, d.y) || y >= Math.max(c.y, d.y)) continue;
          if (!hops.some((h) => h.x === x && h.y === y)) hops.push({ x, y });
        }
      }
    }
    if (hops.length) {
      path.hops = hops.sort((p, q) => p.y - q.y || p.x - q.x);
      path.hopRadius = radius;
    }
  }
}

function hull(n: LNode): Rect {
  return { x: n.x, y: n.y, width: n.box.width, height: n.box.height };
}

function style(s: TextStyle, fontFamily: string): SceneText["style"] {
  return { ...s, fontFamily };
}

function text(
  metrics: FontMetrics,
  t: Omit<SceneText, "type" | "lineHeight" | "ascent" | "width">,
): SceneText {
  const width = Math.max(0, ...t.lines.map((l) => measureLine(metrics, l, t.style.size, t.style.weight)));
  return {
    type: "text",
    ...t,
    lineHeight: t.style.size * LINE_HEIGHT,
    ascent: ascent(metrics, t.style.size),
    width,
  };
}


function pinLabelAnchor(side: Side, p: Point, inner: Rect): [number, number, SceneText["anchor"], SceneText["baseline"]] {
  switch (side) {
    case "left": return [inner.x, p.y, "start", "middle"];
    case "right": return [inner.x + inner.width, p.y, "end", "middle"];
    case "top": return [p.x, inner.y, "middle", "top"];
    case "bottom": return [p.x, inner.y + inner.height, "middle", "bottom"];
  }
}

function angleOf(side: Side): SceneMarker["angle"] {
  return side === "right" ? 0 : side === "bottom" ? 90 : side === "left" ? 180 : 270;
}

/** Direction from `from` to `to` as an angle. */
function direction(from: Point, to: Point): SceneMarker["angle"] {
  if (to.x > from.x) return 0;
  if (to.y > from.y) return 90;
  if (to.x < from.x) return 180;
  return 270;
}

function extent(items: readonly SceneItem[]): Rect {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const add = (x: number, y: number, w = 0, h = 0) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  };
  for (const item of items) {
    switch (item.type) {
      case "rect":
      case "shape": add(item.x, item.y, item.width, item.height); break;
      case "icon": add(item.x, item.y, item.size, item.size); break;
      case "path": for (const p of item.points) add(p.x - item.strokeWidth, p.y - item.strokeWidth, 2 * item.strokeWidth, 2 * item.strokeWidth); break;
      case "marker": add(item.x - item.size, item.y - item.size, 2 * item.size, 2 * item.size); break;
      case "text": { const b = textBounds(item); add(b.x, b.y, b.width, b.height); break; }
    }
  }
  if (minX === Infinity) return { x: 0, y: 0, width: 0, height: 0 };
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function translate(item: SceneItem, dx: number, dy: number): SceneItem {
  switch (item.type) {
    case "path": {
      const move = (p: Point) => ({ x: p.x + dx, y: p.y + dy });
      return { ...item, points: item.points.map(move), ...(item.hops && { hops: item.hops.map(move) }) };
    }
    default: return { ...item, x: item.x + dx, y: item.y + dy };
  }
}

