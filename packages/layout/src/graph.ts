import type { ArchitectureModel, Component, Connection, Direction, Side } from "@sysarch/core";
import type { ComponentBox } from "./size.js";

/** Attachment point on the hull: a real pin or a virtual port on the body. */
export interface Port {
  side: Side;
  /** Along the side, relative to the hull (y for left/right, x for top/bottom). */
  offset: number;
  pin?: string;
}

export interface LNode {
  index: number;
  id: string;
  component: Component;
  box: ComponentBox;
  zone: number;
  /** Systems from outermost to innermost (zone excluded). */
  systems: string[];
  rank: number;
  fixedRank?: number;
  fixedSlot?: number;
  /** Ranks resp. rows spanned from `grid`, at least 1. */
  mainSpan: number;
  crossSpan: number;
  /** Position within the rank. */
  order: number;
  /** Hull, absolute coordinates. */
  x: number;
  y: number;
  pinPorts: Map<string, Port>;
}

export interface LEdge {
  index: number;
  connection: Connection;
  source: LNode;
  target: LNode;
  sourcePort: Port;
  targetPort: Port;
  /** Back edge of a broken cycle, or one running against the zone order. */
  feedback: boolean;
  /** 1 for directed, 0.5 for bidirectional and undirected connections. */
  weight: number;
}

export type AbstractSide = "mainStart" | "mainEnd" | "crossStart" | "crossEnd";

/** Works in abstract axes: main = flow direction, cross = perpendicular to it. */
export class Axes {
  constructor(readonly direction: Direction) {}

  main(n: { x: number; y: number }): number { return this.direction === "LR" ? n.x : n.y; }
  cross(n: { x: number; y: number }): number { return this.direction === "LR" ? n.y : n.x; }
  mainSize(n: { width: number; height: number }): number { return this.direction === "LR" ? n.width : n.height; }
  crossSize(n: { width: number; height: number }): number { return this.direction === "LR" ? n.height : n.width; }

  setMain(n: LNode, value: number): void {
    if (this.direction === "LR") n.x = value;
    else n.y = value;
  }
  setCross(n: LNode, value: number): void {
    if (this.direction === "LR") n.y = value;
    else n.x = value;
  }

  side(side: Side): AbstractSide {
    if (this.direction === "LR") {
      return side === "left" ? "mainStart" : side === "right" ? "mainEnd" : side === "top" ? "crossStart" : "crossEnd";
    }
    return side === "top" ? "mainStart" : side === "bottom" ? "mainEnd" : side === "left" ? "crossStart" : "crossEnd";
  }

  realSide(side: AbstractSide): Side {
    const lr = this.direction === "LR";
    switch (side) {
      case "mainStart": return lr ? "left" : "top";
      case "mainEnd": return lr ? "right" : "bottom";
      case "crossStart": return lr ? "top" : "left";
      case "crossEnd": return lr ? "bottom" : "right";
    }
  }

  /** Cross coordinate of a port relative to the hull. */
  portCrossOffset(node: LNode, port: Port): number {
    const side = this.side(port.side);
    if (side === "mainStart" || side === "mainEnd") return port.offset;
    return side === "crossStart" ? 0 : this.crossSize(node.box);
  }
}

export function buildNodes(model: ArchitectureModel, boxes: Map<string, ComponentBox>): { nodes: LNode[]; zones: string[] } {
  const zones = model.root.children.filter((id) => model.groups.get(id)?.type === "zone");
  const nodes: LNode[] = [];
  for (const component of model.components.values()) {
    const zone = zones.indexOf(component.groupPath[0] ?? "");
    const box = boxes.get(component.id)!;
    nodes.push({
      index: nodes.length,
      id: component.id,
      component,
      box,
      zone: Math.max(zone, 0),
      systems: zone >= 0 ? component.groupPath.slice(1) : component.groupPath,
      rank: 0,
      mainSpan: 1,
      crossSpan: 1,
      order: 0,
      x: 0,
      y: 0,
      pinPorts: new Map(box.pins.map((p) => [p.name, { side: p.side, offset: p.offset, pin: p.name }])),
    });
  }
  return { nodes, zones };
}

/** Last rank occupied by a node. */
export const rankEnd = (n: LNode) => n.rank + n.mainSpan - 1;

/** Gap between two nodes along the flow direction: after rank `after`, `width` ranks wide. Overlapping ranks → undefined. */
export function rankGap(a: LNode, b: LNode): { after: number; width: number } | undefined {
  if (rankEnd(a) < b.rank) return { after: rankEnd(a), width: b.rank - rankEnd(a) };
  if (rankEnd(b) < a.rank) return { after: rankEnd(b), width: a.rank - rankEnd(b) };
  return undefined;
}

/** Does the node span more than one grid cell? */
export const spans = (n: LNode) => n.mainSpan > 1 || n.crossSpan > 1;

/** Fixed ranks and cross positions from `grid` and `hint`. Occupied cells → the later entry falls back to automatic. */
export function applyOverrides(model: ArchitectureModel, byId: Map<string, LNode>): void {
  const lr = model.direction === "LR";
  const cells = new Map<string, string>();
  const fix = (node: LNode, rank: number | undefined, slot: number | undefined, mainSpan = 1, crossSpan = 1) => {
    if (rank !== undefined && slot !== undefined) {
      const keys: string[] = [];
      for (let m = 0; m < mainSpan; m++) for (let c = 0; c < crossSpan; c++) keys.push(`${rank + m},${slot + c}`);
      if (keys.some((key) => cells.has(key) && cells.get(key) !== node.id)) return;
      for (const key of keys) cells.set(key, node.id);
    }
    if (rank !== undefined) node.fixedRank = rank;
    if (slot !== undefined) node.fixedSlot = slot;
    node.mainSpan = mainSpan;
    node.crossSpan = crossSpan;
  };
  // Spanned cells: one rectangle per component (the resolver guarantees the shape).
  const area = new Map<string, { top: number; bottom: number; left: number; right: number }>();
  model.grid?.rows.forEach((row, r) => {
    row.forEach((id, c) => {
      if (id === null) return;
      const a = area.get(id);
      if (a === undefined) area.set(id, { top: r, bottom: r, left: c, right: c });
      else {
        a.bottom = Math.max(a.bottom, r);
        a.right = Math.max(a.right, c);
      }
    });
  });
  for (const [id, a] of area) {
    const node = byId.get(id);
    if (!node) continue;
    const rows = a.bottom - a.top + 1;
    const columns = a.right - a.left + 1;
    if (lr) fix(node, a.left, a.top, columns, rows);
    else fix(node, a.top, a.left, rows, columns);
  }
  for (const node of byId.values()) {
    const { row, column } = node.component.hints;
    if (row === undefined && column === undefined) continue;
    const main = lr ? column : row;
    const cross = lr ? row : column;
    fix(node, main === undefined ? node.fixedRank : main - 1, cross === undefined ? node.fixedSlot : cross - 1, node.mainSpan, node.crossSpan);
  }
}
