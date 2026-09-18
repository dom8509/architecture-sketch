import { SIGNAL_GROUPS, type Side, type SignalGroup } from "@sysarch/core";
import type { LEdge, LNode, Port } from "./graph.js";
import type { Frame } from "./place.js";
import type { Point, Rect } from "./scene.js";

/** Costs in grid units. */
const COST = {
  step: 1,
  bend: 4,
  crossing: 3,
  overlap: 40,
  foreignStub: 20,
  frameLine: 2,
  groupLabel: 8,
  /** Feedback edges run around the outside: steps towards the cross-start side cost more. */
  feedbackDrift: 0.5,
};

const MARGIN = 4;
const ROUTE_ORDER: readonly SignalGroup[] = ["supply", "bus", "single", "diagnostic"];

/** Direction: 0 = +x, 1 = +y, 2 = −x, 3 = −y. */
const DX = [1, 0, -1, 0] as const;
const DY = [0, 1, 0, -1] as const;
const OUTWARD: Record<Side, number> = { right: 0, bottom: 1, left: 2, top: 3 };

export function portPoint(node: LNode, port: Port): Point {
  switch (port.side) {
    case "left": return { x: node.x, y: node.y + port.offset };
    case "right": return { x: node.x + node.box.width, y: node.y + port.offset };
    case "top": return { x: node.x + port.offset, y: node.y };
    case "bottom": return { x: node.x + port.offset, y: node.y + node.box.height };
  }
}

export interface RouteInput {
  nodes: readonly LNode[];
  edges: readonly LEdge[];
  frames: readonly Frame[];
  /** Bounding boxes of the group labels. */
  groupLabels: readonly Rect[];
  grid: number;
  /** Cross-start direction for feedback edges (LR: −y, TB: −x). */
  crossStartDirection: number;
}

/** Phase 7: orthogonal routing via A* on the grid. Returns the corner points per edge. */
export function routeEdges(input: RouteInput): Map<LEdge, Point[]> {
  const { nodes, grid } = input;
  const bounds = {
    minX: Math.min(...nodes.map((n) => n.x), ...input.frames.map((f) => f.rect.x)),
    minY: Math.min(...nodes.map((n) => n.y), ...input.frames.map((f) => f.rect.y)),
    maxX: Math.max(...nodes.map((n) => n.x + n.box.width), ...input.frames.map((f) => f.rect.x + f.rect.width)),
    maxY: Math.max(...nodes.map((n) => n.y + n.box.height), ...input.frames.map((f) => f.rect.y + f.rect.height)),
  };
  const ox = Math.floor(bounds.minX / grid) * grid - MARGIN * grid;
  const oy = Math.floor(bounds.minY / grid) * grid - MARGIN * grid;
  const cols = Math.ceil((bounds.maxX - ox) / grid) + MARGIN + 1;
  const rows = Math.ceil((bounds.maxY - oy) / grid) + MARGIN + 1;
  const index = (i: number, j: number) => j * cols + i;
  const toCell = (p: Point) => ({ i: Math.round((p.x - ox) / grid), j: Math.round((p.y - oy) / grid) });

  const blocked = new Uint8Array(cols * rows);
  for (const n of nodes) {
    const a = toCell({ x: n.x, y: n.y });
    const b = toCell({ x: n.x + n.box.width, y: n.y + n.box.height });
    for (let j = a.j; j <= b.j; j++) for (let i = a.i; i <= b.i; i++) blocked[index(i, j)] = 1;
  }

  const extraCost = new Float64Array(cols * rows);
  for (const label of input.groupLabels) {
    const a = toCell({ x: label.x, y: label.y });
    const b = toCell({ x: label.x + label.width, y: label.y + label.height });
    for (let j = a.j; j <= b.j; j++) {
      for (let i = a.i; i <= b.i; i++) if (i >= 0 && j >= 0 && i < cols && j < rows) extraCost[index(i, j)] = extraCost[index(i, j)]! + COST.groupLabel;
    }
  }
  /** Frame lines: horizontal (bit 1) and vertical (bit 2) edges. */
  const frameLines = new Uint8Array(cols * rows);
  for (const f of input.frames) {
    const a = toCell({ x: f.rect.x, y: f.rect.y });
    const b = toCell({ x: f.rect.x + f.rect.width, y: f.rect.y + f.rect.height });
    for (let i = a.i; i <= b.i; i++) {
      for (const j of [a.j, b.j]) if (i >= 0 && j >= 0 && i < cols && j < rows) frameLines[index(i, j)] = frameLines[index(i, j)]! | 1;
    }
    for (let j = a.j; j <= b.j; j++) {
      for (const i of [a.i, b.i]) if (i >= 0 && j >= 0 && i < cols && j < rows) frameLines[index(i, j)] = frameLines[index(i, j)]! | 2;
    }
  }

  const endpointKey = (e: LEdge, end: "source" | "target") => {
    const port = end === "source" ? e.sourcePort : e.targetPort;
    const node = e[end];
    return port.pin !== undefined ? `${node.id}.${port.pin}` : `${node.id}#${port.side}${port.offset}`;
  };

  /** Stub points of all ports, with their owner. */
  const stubOwner = new Map<number, string>();
  for (const e of input.edges) {
    for (const end of ["source", "target"] as const) {
      const port = end === "source" ? e.sourcePort : e.targetPort;
      const p = portPoint(e[end], port);
      const c = toCell(p);
      const d = OUTWARD[port.side];
      stubOwner.set(index(c.i + DX[d]!, c.j + DY[d]!), endpointKey(e, end));
    }
  }
  for (const n of nodes) {
    for (const port of n.pinPorts.values()) {
      const c = toCell(portPoint(n, port));
      const d = OUTWARD[port.side];
      const k = index(c.i + DX[d]!, c.j + DY[d]!);
      if (!stubOwner.has(k)) stubOwner.set(k, `${n.id}.${port.pin}`);
    }
  }

  /** Occupancy: edge (point + axis) → endpoint keys of the paths; points → axis bits. */
  const edgeUse = new Map<number, string[][]>();
  const pointUse = new Map<number, { axis: number; keys: string[] }[]>();
  const edgeId = (k: number, axis: number) => k * 2 + axis;

  const sorted = [...input.edges].sort(
    (a, b) =>
      ROUTE_ORDER.indexOf(SIGNAL_GROUPS[a.connection.kind]) - ROUTE_ORDER.indexOf(SIGNAL_GROUPS[b.connection.kind]) ||
      a.index - b.index,
  );

  const result = new Map<LEdge, Point[]>();
  for (const e of sorted) {
    const keys = [endpointKey(e, "source"), endpointKey(e, "target")];
    const shares = (entry: string[]) => entry.some((k) => keys.includes(k));
    const start = portPoint(e.source, e.sourcePort);
    const goal = portPoint(e.target, e.targetPort);
    const sc = toCell(start);
    const gc = toCell(goal);
    const outDir = OUTWARD[e.sourcePort.side];
    const inDir = (OUTWARD[e.targetPort.side] + 2) % 4;
    const s = { i: sc.i + DX[outDir]!, j: sc.j + DY[outDir]! };
    const t = { i: gc.i - DX[inDir]!, j: gc.j - DY[inDir]! };
    const goalIndex = index(gc.i, gc.j);
    const targetStub = index(t.i, t.j);

    const size = cols * rows * 4;
    const gScore = new Float64Array(size).fill(Infinity);
    const parent = new Int32Array(size).fill(-1);
    const closed = new Uint8Array(size);
    const heap: Heap = { priority: [], order: [], value: [] };
    const startState = index(s.i, s.j) * 4 + outDir;
    gScore[startState] = 0;
    heapPush(heap, Math.abs(s.i - t.i) + Math.abs(s.j - t.j), 0, startState);
    let counter = 1;
    let found = -1;

    while (heap.value.length > 0) {
      const state = heapPop(heap);
      if (closed[state]) continue;
      closed[state] = 1;
      const k = state >> 2;
      const d = state & 3;
      if (k === goalIndex) {
        found = state;
        break;
      }
      const i = k % cols;
      const j = (k - i) / cols;
      for (let nd = 0; nd < 4; nd++) {
        if (nd === (d + 2) % 4) continue;
        const ni = i + DX[nd]!;
        const nj = j + DY[nd]!;
        if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
        const nk = index(ni, nj);
        if (nk === goalIndex) {
          if (k !== targetStub || nd !== inDir) continue;
        } else if (blocked[nk]) {
          continue;
        }
        let cost = COST.step + (nd !== d ? COST.bend : 0) + extraCost[nk]!;
        const axis = nd % 2;
        const from = nd === 0 || nd === 1 ? k : nk;
        for (const entry of edgeUse.get(edgeId(from, axis)) ?? []) if (!shares(entry)) cost += COST.overlap;
        for (const use of pointUse.get(nk) ?? []) {
          if (use.axis !== axis && !shares(use.keys)) cost += COST.crossing;
        }
        const owner = stubOwner.get(nk);
        if (owner !== undefined && !keys.includes(owner)) cost += COST.foreignStub;
        if (frameLines[nk]! & (axis === 0 ? 1 : 2) && frameLines[k]! & (axis === 0 ? 1 : 2)) cost += COST.frameLine;
        if (e.feedback && nd === input.crossStartDirection) cost += COST.feedbackDrift;
        const next = nk * 4 + nd;
        const g = gScore[state]! + cost;
        if (g < gScore[next]!) {
          gScore[next] = g;
          parent[next] = state;
          const h = Math.abs(ni - t.i) + Math.abs(nj - t.j);
          heapPush(heap, g + h, counter++, next);
        }
      }
    }

    let cells: { i: number; j: number }[];
    if (found < 0) {
      // No path (enclosed port): fall back to an L shape, still orthogonal.
      cells = [sc, s, { i: t.i, j: s.j }, t, gc];
    } else {
      cells = [];
      for (let st = found; st >= 0; st = parent[st]!) {
        const k = st >> 2;
        cells.push({ i: k % cols, j: Math.floor(k / cols) });
      }
      cells.push(sc);
      cells.reverse();
    }

    // Record the occupancy.
    for (let n = 1; n < cells.length; n++) {
      const a = cells[n - 1]!;
      const b = cells[n]!;
      const steps = Math.abs(b.i - a.i) + Math.abs(b.j - a.j);
      const di = Math.sign(b.i - a.i);
      const dj = Math.sign(b.j - a.j);
      const axis = dj === 0 ? 0 : 1;
      for (let step = 0; step < steps; step++) {
        const p = { i: a.i + di * step, j: a.j + dj * step };
        const q = { i: p.i + di, j: p.j + dj };
        const from = di + dj > 0 ? index(p.i, p.j) : index(q.i, q.j);
        const id = edgeId(from, axis);
        if (!edgeUse.has(id)) edgeUse.set(id, []);
        edgeUse.get(id)!.push(keys);
        for (const point of [index(p.i, p.j), index(q.i, q.j)]) {
          if (!pointUse.has(point)) pointUse.set(point, []);
          pointUse.get(point)!.push({ axis, keys });
        }
      }
    }

    const points = simplify(cells.map((c) => ({ x: ox + c.i * grid, y: oy + c.j * grid })));
    result.set(e, points);
  }
  return result;
}

/** Removes duplicate and collinear intermediate points. */
export function simplify(points: Point[]): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (last && last.x === p.x && last.y === p.y) continue;
    const before = out[out.length - 2];
    if (before && last && ((before.x === last.x && last.x === p.x) || (before.y === last.y && last.y === p.y))) {
      out[out.length - 1] = p;
    } else {
      out.push(p);
    }
  }
  return out;
}

/** Binary min heap over (priority, insertion counter) — deterministic tie-breaking. */
interface Heap {
  priority: number[];
  order: number[];
  value: number[];
}

function heapLess(h: Heap, a: number, b: number): boolean {
  return h.priority[a]! < h.priority[b]! || (h.priority[a] === h.priority[b] && h.order[a]! < h.order[b]!);
}

function heapSwap(h: Heap, a: number, b: number): void {
  for (const arr of [h.priority, h.order, h.value]) {
    const t = arr[a]!;
    arr[a] = arr[b]!;
    arr[b] = t;
  }
}

function heapPush(h: Heap, priority: number, order: number, value: number): void {
  h.priority.push(priority);
  h.order.push(order);
  h.value.push(value);
  let i = h.value.length - 1;
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (!heapLess(h, i, p)) break;
    heapSwap(h, i, p);
    i = p;
  }
}

function heapPop(h: Heap): number {
  const top = h.value[0]!;
  heapSwap(h, 0, h.value.length - 1);
  h.priority.pop();
  h.order.pop();
  h.value.pop();
  let i = 0;
  for (;;) {
    const l = 2 * i + 1;
    const r = l + 1;
    let m = i;
    if (l < h.value.length && heapLess(h, l, m)) m = l;
    if (r < h.value.length && heapLess(h, r, m)) m = r;
    if (m === i) break;
    heapSwap(h, i, m);
    i = m;
  }
  return top;
}
