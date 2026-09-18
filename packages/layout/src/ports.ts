import type { Side } from "@sysarch/core";
import { rankEnd, spans, type Axes, type LEdge, type LNode, type Port } from "./graph.js";
import { portPoint } from "./route.js";
import type { Rect } from "./scene.js";

/**
 * Body ports (a connection without a pin) get a virtual port on the side facing the other
 * end; several ports on one side are spread over free grid points around the middle,
 * sorted by the position of the other end. Feedback edges attach at the bottom (LR) resp.
 * on the right (TB).
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
      else if (other.rank > rankEnd(node)) side = axes.realSide("mainEnd");
      else if (rankEnd(other) < node.rank) side = axes.realSide("mainStart");
      else side = axes.realSide(crossAfter(other, node) ? "crossEnd" : "crossStart");
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

    // Cross position of the other end: rank for cross sides, order for main sides.
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

/** Does `a` sit after `b` across? Within a rank the order counts, across ranks the fixed row. */
function crossAfter(a: LNode, b: LNode): boolean {
  if (a.rank !== b.rank && a.fixedSlot !== undefined && b.fixedSlot !== undefined) return a.fixedSlot > b.fixedSlot;
  return a.order > b.order;
}

/**
 * After placement: body ports of connections involving a spanning node are reassigned from
 * the actual positions. The other end points at the spanning node with the middle of its
 * side, and the spanning node puts its port exactly opposite — the line runs straight even
 * when several components sit above resp. below it. The port of the other end dodges group
 * labels between the two nodes.
 */
export function alignSpanPorts(edges: readonly LEdge[], axes: Axes, grid: number, labels: readonly Rect[] = []): void {
  const affected = edges.filter((e) => e.source !== e.target && !e.feedback && (spans(e.source) || spans(e.target)));
  if (affected.length === 0) return;

  const range = (n: LNode, main: boolean) => {
    const start = main ? axes.main(n) : axes.cross(n);
    return [start, start + (main ? axes.mainSize(n.box) : axes.crossSize(n.box))] as const;
  };
  const sideTowards = (node: LNode, other: LNode): Side => {
    const [ms, me] = range(node, true);
    const [os, oe] = range(other, true);
    if (os < me && ms < oe) {
      return axes.realSide(axes.cross(other) + axes.crossSize(other.box) / 2 > axes.cross(node) + axes.crossSize(node.box) / 2 ? "crossEnd" : "crossStart");
    }
    return axes.realSide(os >= me ? "mainEnd" : "mainStart");
  };
  // Provisional ports of the affected ends do not count as occupied, only already reassigned ones.
  const pending = new Set<Port>(affected.flatMap((e) => [e.sourcePort, e.targetPort]).filter((p) => p.pin === undefined));
  const length = (n: LNode, side: Side) => (side === "left" || side === "right" ? n.box.height : n.box.width);
  const taken = (n: LNode, side: Side, except: Port) => {
    const used = [...n.pinPorts.values()].filter((p) => p.side === side).map((p) => p.offset);
    for (const e of edges) {
      for (const port of [e.source === n ? e.sourcePort : undefined, e.target === n ? e.targetPort : undefined]) {
        if (port && port !== except && !pending.has(port) && port.pin === undefined && port.side === side) used.push(port.offset);
      }
    }
    return new Set(used);
  };
  /** Does the straight line from the port to the other end cross a group label? */
  const hitsLabel = (n: LNode, side: Side, offset: number, other: LNode) => {
    const p = portPoint(n, { side, offset });
    const vertical = side === "top" || side === "bottom";
    const [from, to] = vertical
      ? [Math.min(p.y, other.y + other.box.height), Math.max(p.y, other.y)]
      : [Math.min(p.x, other.x + other.box.width), Math.max(p.x, other.x)];
    return labels.some((l) => vertical
      ? p.x >= l.x - grid / 2 && p.x <= l.x + l.width + grid / 2 && l.y < to && l.y + l.height > from
      : p.y >= l.y - grid / 2 && p.y <= l.y + l.height + grid / 2 && l.x < to && l.x + l.width > from);
  };
  /** Free grid point on the side, as close to `wanted` as possible; crossing a label only as a last resort. */
  const nearestFree = (n: LNode, side: Side, wanted: number, except: Port, other: LNode) => {
    const used = taken(n, side, except);
    const max = length(n, side) - grid;
    const start = Math.min(Math.max(Math.round(wanted / grid) * grid, grid), max);
    for (const avoidLabels of [true, false]) {
      for (let d = 0; d <= max; d += grid) {
        for (const p of [start - d, start + d]) {
          if (p < grid || p > max || used.has(p)) continue;
          if (!avoidLabels || !hitsLabel(n, side, p, other)) return p;
        }
      }
    }
    return start;
  };
  const set = (e: LEdge, end: "source" | "target", port: Port) => {
    if (end === "source") e.sourcePort = port;
    else e.targetPort = port;
  };

  // First the ends on normal nodes (middle of the side), then the spanning ends opposite them.
  for (const pass of [false, true]) {
    for (const e of affected) {
      for (const end of ["source", "target"] as const) {
        const node = e[end];
        const other = end === "source" ? e.target : e.source;
        const port = end === "source" ? e.sourcePort : e.targetPort;
        if (port.pin !== undefined || spans(node) !== pass) continue;
        const side = sideTowards(node, other);
        let wanted = length(node, side) / 2;
        if (pass) {
          const otherPort = end === "source" ? e.targetPort : e.sourcePort;
          const p = portPoint(other, otherPort);
          wanted = side === "left" || side === "right" ? p.y - node.y : p.x - node.x;
        }
        const placeholder: Port = { side, offset: -1 };
        set(e, end, placeholder);
        placeholder.offset = nearestFree(node, side, wanted, placeholder, other);
      }
    }
  }
}
