import type { ArchitectureModel, Component, Connection, Direction, Side } from "@sysarch/core";
import type { ComponentBox } from "./size.js";

/** Anschlusspunkt an der Hülle: echter Pin oder virtueller Port am Körper. */
export interface Port {
  side: Side;
  /** Entlang der Seite, relativ zur Hülle (y für links/rechts, x für oben/unten). */
  offset: number;
  pin?: string;
}

export interface LNode {
  index: number;
  id: string;
  component: Component;
  box: ComponentBox;
  zone: number;
  /** Systeme von außen nach innen (ohne Zone). */
  systems: string[];
  rank: number;
  fixedRank?: number;
  fixedSlot?: number;
  /** Position innerhalb des Rangs. */
  order: number;
  /** Hülle, absolute Koordinaten. */
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
  /** Rückwärtskante eines gebrochenen Zyklus oder gegen die Zonenreihenfolge. */
  feedback: boolean;
  /** 1 für gerichtete, 0,5 für bidirektionale und ungerichtete Verbindungen. */
  weight: number;
}

export type AbstractSide = "mainStart" | "mainEnd" | "crossStart" | "crossEnd";

/** Rechnet in abstrakten Achsen: main = Flussrichtung, cross = quer dazu. */
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

  /** Querkoordinate eines Ports relativ zur Hülle. */
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
      order: 0,
      x: 0,
      y: 0,
      pinPorts: new Map(box.pins.map((p) => [p.name, { side: p.side, offset: p.offset, pin: p.name }])),
    });
  }
  return { nodes, zones };
}

/** Feste Ränge und Querpositionen aus `grid` und `hint`. Belegte Zellen → späterer Eintrag fällt auf automatisch zurück. */
export function applyOverrides(model: ArchitectureModel, byId: Map<string, LNode>): void {
  const lr = model.direction === "LR";
  const cells = new Map<string, string>();
  const fix = (node: LNode, rank: number | undefined, slot: number | undefined) => {
    if (rank !== undefined && slot !== undefined) {
      const key = `${rank},${slot}`;
      const owner = cells.get(key);
      if (owner !== undefined && owner !== node.id) return;
      cells.set(key, node.id);
    }
    if (rank !== undefined) node.fixedRank = rank;
    if (slot !== undefined) node.fixedSlot = slot;
  };
  model.grid?.rows.forEach((row, r) => {
    row.forEach((id, c) => {
      const node = id === null ? undefined : byId.get(id);
      if (node) fix(node, lr ? c : r, lr ? r : c);
    });
  });
  for (const node of byId.values()) {
    const { row, column } = node.component.hints;
    if (row === undefined && column === undefined) continue;
    const main = lr ? column : row;
    const cross = lr ? row : column;
    fix(node, main === undefined ? node.fixedRank : main - 1, cross === undefined ? node.fixedSlot : cross - 1);
  }
}
