import type { ArchitectureModel, Group } from "@sysarch/core";
import { LINE_HEIGHT, type Theme } from "@sysarch/themes";
import { rankEnd, rankGap, spans, type AbstractSide, type Axes, type LEdge, type LNode } from "./graph.js";
import type { Rect } from "./scene.js";

export interface Frame {
  group: Group;
  rect: Rect;
  /** Nesting depth; zones 0, systems 1 and up. */
  depth: number;
  members: LNode[];
}

type Insets = Record<AbstractSide, number>;

interface Context {
  model: ArchitectureModel;
  theme: Theme;
  axes: Axes;
  nodes: readonly LNode[];
  edges: readonly LEdge[];
  layers: LNode[][];
  zones: readonly string[];
  /** Minimum spacing after rank r so that connection labels fit between r and r+1. */
  labelSpace: readonly number[];
  /** Sets the hull of a spanning node to minimum sizes along main resp. cross (undefined = unchanged). */
  stretch: (n: LNode, main: number | undefined, cross: number | undefined) => void;
  /** Hull without stretching. */
  natural: (n: LNode) => { width: number; height: number };
}

const MAX_REPAIRS = 200;

/** Phase 6: coordinates. Sets `x`/`y` of all nodes and returns the zone and system frames. */
export function placeNodes(ctx: Context): Frame[] {
  const { theme, axes, layers } = ctx;
  const { grid } = theme.spacing;

  const groupInsets = (group: Group): Insets => {
    const pad = theme.spacing.groupPadding;
    const label = group.label ? Math.ceil((theme.typography.group.size * LINE_HEIGHT) / grid) * grid : 0;
    const top: AbstractSide = axes.side("top");
    const insets: Insets = { mainStart: pad, mainEnd: pad, crossStart: pad, crossEnd: pad };
    insets[top] += label;
    return insets;
  };
  const insetsOf = new Map<string, Insets>();
  for (const group of ctx.model.groups.values()) insetsOf.set(group.id, groupInsets(group));

  const zoneCrossStart = ctx.zones.reduce((m, z) => Math.max(m, insetsOf.get(z)!.crossStart), 0);

  // ── Cross coordinates ────────────────────────────────────────
  const commonDepth = (a: LNode, b: LNode) => {
    let k = 0;
    while (k < a.systems.length && k < b.systems.length && a.systems[k] === b.systems[k]) k++;
    return k;
  };
  const minDistance = (above: LNode, below: LNode) => {
    const k = commonDepth(above, below);
    let d = theme.spacing.nodeGapCross;
    for (const s of above.systems.slice(k)) d += insetsOf.get(s)!.crossEnd;
    for (const s of below.systems.slice(k)) d += insetsOf.get(s)!.crossStart;
    return d;
  };
  const firstOffset = (n: LNode) => n.systems.reduce((d, s) => d + insetsOf.get(s)!.crossStart, zoneCrossStart);
  const cross = (n: LNode) => axes.cross(n);
  const crossEnd = (n: LNode) => axes.cross(n) + axes.crossSize(n.box);

  const incident = new Map<LNode, LEdge[]>(ctx.nodes.map((n) => [n, []]));
  for (const e of ctx.edges) {
    if (e.source === e.target) continue;
    incident.get(e.source)!.push(e);
    incident.get(e.target)!.push(e);
  }
  const portCross = (e: LEdge, node: LNode) =>
    axes.cross(node) + axes.portCrossOffset(node, e.source === node ? e.sourcePort : e.targetPort);

  /** Restacks a rank from `from` on without moving any node upwards. */
  const restack = (layer: LNode[], from = 0) => {
    for (let i = Math.max(from, 0); i < layer.length; i++) {
      const n = layer[i]!;
      const min = i === 0 ? firstOffset(n) : crossEnd(layer[i - 1]!) + minDistance(layer[i - 1]!, n);
      if (cross(n) < min) axes.setCross(n, min);
    }
  };

  /** Is the fixed row of `n` inside the rows of `other`? Pin alignment must not leave a row. */
  const sameRow = (n: LNode, other: LNode) =>
    n.fixedSlot === undefined || other.fixedSlot === undefined ||
    (other.fixedSlot <= n.fixedSlot && n.fixedSlot <= other.fixedSlot + other.crossSpan - 1);
  const lastSlot = (n: LNode) => n.fixedSlot! + n.crossSpan - 1;
  const crossSpanners = ctx.nodes.filter((n) => n.crossSpan > 1 && n.fixedSlot !== undefined);

  // Fixed rows: a shared top edge per row, iterate until stable.
  const rowTop = new Map<number, number>();
  /** Position without pin alignment; only this determines the row top, otherwise rows drift apart. */
  const unaligned = new Map<LNode, number>();
  for (let pass = 0; pass < (crossSpanners.length ? 8 : 3); pass++) {
    for (const layer of layers) {
      layer.forEach((n, i) => {
        let min = i === 0 ? firstOffset(n) : crossEnd(layer[i - 1]!) + minDistance(layer[i - 1]!, n);
        if (n.fixedSlot !== undefined) {
          min = Math.max(min, rowTop.get(n.fixedSlot) ?? 0);
          for (const [slot, top] of rowTop) if (slot < n.fixedSlot) min = Math.max(min, top + theme.spacing.nodeGapCross);
        }
        // Pin alignment: exactly one connection to the preceding rank.
        const lower = incident.get(n)!.filter((e) => rankEnd(e.source === n ? e.target : e.source) < n.rank);
        unaligned.set(n, snap(min, grid));
        let value = min;
        // Spanning nodes are not aligned: their ports follow once the other end is placed.
        if (lower.length === 1 && !spans(n) && sameRow(n, lower[0]!.source === n ? lower[0]!.target : lower[0]!.source)) {
          const e = lower[0]!;
          const other = e.source === n ? e.target : e.source;
          const desired = portCross(e, other) - axes.portCrossOffset(n, e.source === n ? e.sourcePort : e.targetPort);
          value = Math.max(min, desired);
        }
        axes.setCross(n, snap(value, grid));
      });
    }
    let changed = false;
    // Nodes spanning several rows reach down to the bottom edge of their last row.
    for (const n of crossSpanners) {
      const row = ctx.nodes.filter((m) => m !== n && m.fixedSlot !== undefined && lastSlot(m) === lastSlot(n));
      const bottom = Math.max(...row.map(crossEnd), -Infinity);
      const size = Math.max(axes.crossSize(ctx.natural(n)), bottom - cross(n));
      if (size !== axes.crossSize(n.box)) {
        ctx.stretch(n, undefined, size);
        changed = true;
      }
    }
    for (const n of ctx.nodes) {
      if (n.fixedSlot === undefined) continue;
      const top = Math.max(rowTop.get(n.fixedSlot) ?? 0, unaligned.get(n)!);
      if (top !== rowTop.get(n.fixedSlot)) {
        rowTop.set(n.fixedSlot, top);
        changed = true;
      }
      // Later rows start below the bottom edge of this row.
      for (const [slot, t] of rowTop) {
        if (slot > lastSlot(n) && t < crossEnd(n) + theme.spacing.nodeGapCross) {
          rowTop.set(slot, crossEnd(n) + theme.spacing.nodeGapCross);
          changed = true;
        }
      }
    }
    if (!changed) break;
  }

  // Sources align with their single successor as far as there is room.
  for (let r = layers.length - 1; r >= 0; r--) {
    const layer = layers[r]!;
    for (let i = layer.length - 1; i >= 0; i--) {
      const n = layer[i]!;
      const links = incident.get(n)!;
      const others = links.map((e) => (e.source === n ? e.target : e.source));
      if (others.some((o) => rankEnd(o) < n.rank)) continue;
      const higher = links.filter((_, k) => others[k]!.rank > rankEnd(n));
      if (higher.length !== 1) continue;
      const e = higher[0]!;
      const other = e.source === n ? e.target : e.source;
      if (!sameRow(n, other)) continue;
      const desired = snap(portCross(e, other) - axes.portCrossOffset(n, e.source === n ? e.sourcePort : e.targetPort), grid);
      const min = i === 0 ? firstOffset(n) : crossEnd(layer[i - 1]!) + minDistance(layer[i - 1]!, n);
      const next = layer[i + 1];
      const max = next ? cross(next) - minDistance(n, next) - axes.crossSize(n.box) : Infinity;
      if (desired >= min && desired <= max) axes.setCross(n, desired);
    }
  }

  // Nodes spanning several columns: free nodes of the covered ranks move aside across.
  for (const n of ctx.nodes) {
    for (let r = n.rank + 1; r <= rankEnd(n) && n.mainSpan > 1; r++) {
      const layer = layers[r] ?? [];
      layer.forEach((m, i) => {
        if (cross(m) < crossEnd(n) + theme.spacing.nodeGapCross && crossEnd(m) + theme.spacing.nodeGapCross > cross(n)) {
          axes.setCross(m, snap(crossEnd(n) + theme.spacing.nodeGapCross, grid));
          restack(layer, i + 1);
        }
      });
    }
  }

  // ── Main coordinates ─────────────────────────────────────────
  const zoneOfRank = layers.map((layer) => layer[0]?.zone ?? 0);
  const systemRanks = new Map<string, { min: number; max: number }>();
  for (const n of ctx.nodes) {
    for (const s of n.systems) {
      const range = systemRanks.get(s) ?? { min: n.rank, max: rankEnd(n) };
      range.min = Math.min(range.min, n.rank);
      range.max = Math.max(range.max, rankEnd(n));
      systemRanks.set(s, range);
    }
  }
  // Empty ranks (created only by fixed columns) inherit the zone of their predecessor.
  for (let r = 1; r < zoneOfRank.length; r++) if (layers[r]!.length === 0) zoneOfRank[r] = zoneOfRank[r - 1]!;

  const placeMain = (channels: number[]) => {
    // Rank widths excluding nodes spanning several columns; those are stretched across their ranks afterwards.
    const widths = layers.map((layer) => layer.reduce((m, n) => (n.mainSpan > 1 ? m : Math.max(m, axes.mainSize(n.box))), 0));
    const gaps = layers.map((_, r) => {
      if (r === layers.length - 1) return 0;
      let gap = theme.spacing.nodeGapMain;
      if (zoneOfRank[r] !== zoneOfRank[r + 1]) {
        const next = ctx.zones[zoneOfRank[r + 1]!];
        gap = theme.spacing.zoneGap + (next ? insetsOf.get(next)!.mainStart - theme.spacing.groupPadding : 0);
      }
      for (const [s, range] of systemRanks) {
        if (range.max === r) gap += insetsOf.get(s)!.mainEnd;
        if (range.min === r + 1) gap += insetsOf.get(s)!.mainStart;
      }
      gap = Math.max(gap, ctx.labelSpace[r] ?? 0);
      gap += (channels[r] ?? 0) * grid;
      return snap(gap, grid);
    });
    const spanners = ctx.nodes.filter((n) => n.mainSpan > 1);
    const starts: number[] = [];
    const extent = (n: LNode) => starts[rankEnd(n)]! + widths[rankEnd(n)]! - starts[n.rank]!;
    for (let round = 0; round <= spanners.length; round++) {
      let start = 0;
      layers.forEach((_, r) => {
        starts[r] = start;
        start += widths[r]! + gaps[r]!;
      });
      // If the ranks do not add up to enough, the last spanned rank grows.
      const short = spanners.find((n) => extent(n) < axes.mainSize(ctx.natural(n)));
      if (short === undefined) break;
      widths[rankEnd(short)]! += snap(axes.mainSize(ctx.natural(short)) - extent(short), grid);
    }
    layers.forEach((layer, r) => {
      for (const n of layer) {
        if (n.mainSpan > 1) continue;
        axes.setMain(n, starts[r]! + Math.floor((widths[r]! - axes.mainSize(n.box)) / 2 / grid) * grid);
      }
    });
    for (const n of spanners) {
      ctx.stretch(n, extent(n), undefined);
      axes.setMain(n, starts[n.rank]!);
    }
  };

  placeMain([]);
  repairFrames(ctx, insetsOf, restack, grid);

  const channels: number[] = [];
  for (const e of ctx.edges) {
    const gap = rankGap(e.source, e.target);
    if (e.feedback || gap === undefined) continue;
    if (portCross(e, e.source) === portCross(e, e.target)) continue;
    const r = gap.after;
    channels[r] = (channels[r] ?? 0) + 1;
  }
  placeMain(channels);
  repairFrames(ctx, insetsOf, restack, grid);

  return computeFrames(ctx, insetsOf);
}

const snap = (value: number, grid: number) => Math.ceil(value / grid - 1e-9) * grid;

function hullOf(n: LNode): Rect {
  return { x: n.x, y: n.y, width: n.box.width, height: n.box.height };
}

function union(rects: Rect[]): Rect {
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  const right = Math.max(...rects.map((r) => r.x + r.width));
  const bottom = Math.max(...rects.map((r) => r.y + r.height));
  return { x, y, width: right - x, height: bottom - y };
}

function expand(rect: Rect, insets: Insets, axes: Axes): Rect {
  const real = { left: 0, right: 0, top: 0, bottom: 0 };
  for (const side of ["mainStart", "mainEnd", "crossStart", "crossEnd"] as const) real[axes.realSide(side)] = insets[side];
  return {
    x: rect.x - real.left,
    y: rect.y - real.top,
    width: rect.width + real.left + real.right,
    height: rect.height + real.top + real.bottom,
  };
}

export function overlaps(a: Rect, b: Rect, margin = 0): boolean {
  return a.x < b.x + b.width + margin && b.x < a.x + a.width + margin && a.y < b.y + b.height + margin && b.y < a.y + a.height + margin;
}

/** System frames from innermost to outermost. */
function systemFrames(ctx: Context, insetsOf: Map<string, Insets>): Frame[] {
  const frames = new Map<string, Frame>();
  const systems = [...ctx.model.groups.values()].filter((g) => g.type === "system");
  const depthOf = new Map<string, number>();
  for (const n of ctx.nodes) n.systems.forEach((s, d) => depthOf.set(s, d + 1));
  const ordered = [...systems].sort((a, b) => (depthOf.get(b.id) ?? 0) - (depthOf.get(a.id) ?? 0));
  for (const system of ordered) {
    const members = ctx.nodes.filter((n) => n.systems.includes(system.id));
    if (members.length === 0) continue;
    const rects = members.filter((n) => n.systems[n.systems.length - 1] === system.id).map(hullOf);
    for (const child of system.children) {
      const frame = frames.get(child);
      if (frame) rects.push(frame.rect);
    }
    frames.set(system.id, {
      group: system,
      rect: expand(union(rects), insetsOf.get(system.id)!, ctx.axes),
      depth: depthOf.get(system.id) ?? 1,
      members,
    });
  }
  return systems.map((s) => frames.get(s.id)).filter((f): f is Frame => f !== undefined);
}

/** Shifts nodes across until no system frame overlaps foreign components or foreign frames. */
function repairFrames(
  ctx: Context,
  insetsOf: Map<string, Insets>,
  restack: (layer: LNode[], from?: number) => void,
  grid: number,
): void {
  const { axes } = ctx;
  const gap = ctx.theme.spacing.nodeGapCross / 2;
  const crossOf = (r: Rect) => axes.cross(r);
  const crossEndOf = (r: Rect) => axes.cross(r) + axes.crossSize(r);

  const push = (members: readonly LNode[], delta: number) => {
    const d = Math.ceil(delta / grid) * grid;
    for (const n of members) axes.setCross(n, axes.cross(n) + d);
    for (const layer of ctx.layers) restack(layer);
  };

  for (let i = 0; i < MAX_REPAIRS; i++) {
    const frames = systemFrames(ctx, insetsOf);
    let conflict: [Rect, readonly LNode[], Rect, readonly LNode[]] | undefined;
    search: for (const frame of frames) {
      for (const n of ctx.nodes) {
        if (frame.members.includes(n)) continue;
        const hull = hullOf(n);
        if (overlaps(frame.rect, hull, gap)) {
          conflict = [frame.rect, frame.members, hull, [n]];
          break search;
        }
      }
      for (const other of frames) {
        if (other === frame) continue;
        const nested = other.members.every((m) => frame.members.includes(m)) || frame.members.every((m) => other.members.includes(m));
        if (nested) continue;
        if (overlaps(frame.rect, other.rect, gap)) {
          conflict = [frame.rect, frame.members, other.rect, other.members];
          break search;
        }
      }
    }
    if (conflict === undefined) return;
    const [aRect, aMembers, bRect, bMembers] = conflict;
    // Which one comes first: within a shared rank the order in that rank, otherwise the center.
    let aFirst: boolean | undefined;
    for (const a of aMembers) {
      const b = bMembers.find((m) => m.rank === a.rank);
      if (b) {
        aFirst = a.order < b.order;
        break;
      }
    }
    aFirst ??= crossOf(aRect) + axes.crossSize(aRect) / 2 <= crossOf(bRect) + axes.crossSize(bRect) / 2;
    if (aFirst) push(bMembers, crossEndOf(aRect) + gap * 2 - crossOf(bRect));
    else push(aMembers, crossEndOf(bRect) + gap * 2 - crossOf(aRect));
  }
}

function computeFrames(ctx: Context, insetsOf: Map<string, Insets>): Frame[] {
  const { axes, theme } = ctx;
  const systems = systemFrames(ctx, insetsOf);
  if (ctx.zones.length === 0) return systems;

  const all = [...ctx.nodes.map(hullOf), ...systems.map((f) => f.rect)];
  const crossStart = Math.min(...all.map((r) => axes.cross(r)));
  const crossEnd = Math.max(...all.map((r) => axes.cross(r) + axes.crossSize(r)));
  const zoneCrossInset = ctx.zones.reduce((m, z) => Math.max(m, insetsOf.get(z)!.crossStart), 0);
  const pad = theme.spacing.groupPadding;

  // Main extent per zone: ranks plus frames, the boundary sits in the middle of the zone gap.
  const extents = ctx.zones.map((_, z) => {
    const members = ctx.nodes.filter((n) => n.zone === z);
    const rects = [...members.map(hullOf), ...systems.filter((f) => f.members.some((m) => m.zone === z)).map((f) => f.rect)];
    if (rects.length === 0) return undefined;
    return {
      start: Math.min(...rects.map((r) => axes.main(r))) - insetsOf.get(ctx.zones[z]!)!.mainStart,
      end: Math.max(...rects.map((r) => axes.main(r) + axes.mainSize(r))) + pad,
    };
  });

  const frames: Frame[] = [];
  ctx.zones.forEach((id, z) => {
    const extent = extents[z];
    if (extent === undefined) return;
    const previous = extents.slice(0, z).reverse().find((e) => e !== undefined);
    const next = extents.slice(z + 1).find((e) => e !== undefined);
    const start = previous ? Math.floor((previous.end + extent.start) / 2) : extent.start;
    const end = next ? Math.floor((extent.end + next.start) / 2) : extent.end;
    const mainStart = snapDown(start, theme.spacing.grid);
    const mainEnd = snapDown(end, theme.spacing.grid);
    const cStart = crossStart - zoneCrossInset;
    const cEnd = crossEnd + pad;
    const rect = axes.direction === "LR"
      ? { x: mainStart, y: cStart, width: mainEnd - mainStart, height: cEnd - cStart }
      : { x: cStart, y: mainStart, width: cEnd - cStart, height: mainEnd - mainStart };
    frames.push({ group: ctx.model.groups.get(id)!, rect, depth: 0, members: ctx.nodes.filter((n) => n.zone === z) });
  });
  return [...frames, ...systems];
}

const snapDown = (value: number, grid: number) => Math.floor(value / grid) * grid;
