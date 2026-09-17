import type { Side } from "@sysarch/core";
import type { Axes, LEdge, LNode, Port } from "./graph.js";

/**
 * Körperanschlüsse (Verbindung ohne Pin) erhalten einen virtuellen Port auf der Seite zur
 * Gegenstelle; mehrere Ports auf einer Seite werden auf freie Grid-Punkte um die Mitte
 * verteilt, sortiert nach Lage der Gegenstelle. Rückführungen docken unten (LR) bzw. rechts (TB) an.
 */
export function assignBodyPorts(edges: readonly LEdge[], axes: Axes, grid: number): void {
  interface Request { edge: LEdge; end: "source" | "target"; node: LNode; other: LNode; side: Side }
  const requests: Request[] = [];
  for (const edge of edges) {
    for (const end of ["source", "target"] as const) {
      const node = edge[end];
      const port = end === "source" ? edge.sourcePort : edge.targetPort;
      if (port.pin !== undefined) continue;
      const other = end === "source" ? edge.target : edge.source;
      let side: Side;
      if (edge.feedback || other === node) side = axes.realSide("crossEnd");
      else if (other.rank > node.rank) side = axes.realSide("mainEnd");
      else if (other.rank < node.rank) side = axes.realSide("mainStart");
      else side = axes.realSide(other.order > node.order ? "crossEnd" : "crossStart");
      requests.push({ edge, end, node, other, side });
    }
  }

  const groups = new Map<string, Request[]>();
  for (const r of requests) {
    const key = `${r.node.index}:${r.side}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  for (const list of groups.values()) {
    const { node, side } = list[0]!;
    const length = side === "left" || side === "right" ? node.box.height : node.box.width;
    const taken = new Set([...node.pinPorts.values()].filter((p) => p.side === side).map((p) => p.offset));
    const candidates: number[] = [];
    for (let p = grid; p <= length - grid; p += grid) if (!taken.has(p)) candidates.push(p);
    const center = length / 2;
    candidates.sort((a, b) => Math.abs(a - center) - Math.abs(b - center) || a - b);
    const fallback = Math.max(grid, Math.round(center / grid) * grid);
    const offsets = list.map((_, i) => candidates[i] ?? fallback).sort((a, b) => a - b);

    // Querlage der Gegenstelle: Rang für Querseiten, Reihenfolge für Hauptseiten.
    const along = axes.side(side) === "mainStart" || axes.side(side) === "mainEnd";
    list.sort((a, b) =>
      (along ? a.other.order - b.other.order : a.other.rank - b.other.rank) ||
      a.other.rank - b.other.rank || a.edge.index - b.edge.index,
    );
    list.forEach((r, i) => {
      const port: Port = { side, offset: offsets[i]! };
      if (r.end === "source") r.edge.sourcePort = port;
      else r.edge.targetPort = port;
    });
  }
}
