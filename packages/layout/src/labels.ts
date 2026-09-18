import type { Point, Rect } from "./scene.js";
import { overlaps } from "./place.js";

export interface LabelRequest {
  width: number;
  height: number;
  points: Point[];
  /** Length to keep clear at the ends (markers). */
  endClearance: number;
}

/**
 * Phase 8: connection labels. Candidates: midpoint of the longest segment, the segment at
 * the source pin, the segment at the target pin, then further points along all segments.
 * The first candidate without overlap wins; otherwise the first candidate.
 */
export function placeLabel(
  request: LabelRequest,
  obstacles: readonly Rect[],
  foreignPaths: readonly Point[][],
  grid: number,
): { center: Point; free: boolean } {
  const { points, width, height } = request;
  const segments = points.slice(1).map((b, i) => ({ a: points[i]!, b, index: i }));
  const length = (s: { a: Point; b: Point }) => Math.abs(s.b.x - s.a.x) + Math.abs(s.b.y - s.a.y);
  const longest = [...segments].sort((x, y) => length(y) - length(x) || x.index - y.index)[0];
  if (longest === undefined) return { center: points[0] ?? { x: 0, y: 0 }, free: false };

  const mid = (s: { a: Point; b: Point }) => ({ x: (s.a.x + s.b.x) / 2, y: (s.a.y + s.b.y) / 2 });
  const candidates: { point: Point; segment: { a: Point; b: Point; index: number } }[] = [
    { point: mid(longest), segment: longest },
    { point: mid(segments[0]!), segment: segments[0]! },
    { point: mid(segments[segments.length - 1]!), segment: segments[segments.length - 1]! },
  ];
  for (const s of [...segments].sort((x, y) => length(y) - length(x) || x.index - y.index)) {
    const n = Math.floor(length(s) / grid);
    for (let k = 1; k < n; k++) {
      const t = k / n;
      candidates.push({ point: { x: s.a.x + (s.b.x - s.a.x) * t, y: s.a.y + (s.b.y - s.a.y) * t }, segment: s });
    }
  }

  const fits = (c: (typeof candidates)[number]) => {
    const { point, segment } = c;
    const box = { x: point.x - width / 2, y: point.y - height / 2, width, height };
    const horizontal = segment.a.y === segment.b.y;
    // The label must sit on its segment; end markers stay clear.
    const span = horizontal ? width : height;
    const lo = horizontal ? Math.min(segment.a.x, segment.b.x) : Math.min(segment.a.y, segment.b.y);
    const hi = horizontal ? Math.max(segment.a.x, segment.b.x) : Math.max(segment.a.y, segment.b.y);
    const at = horizontal ? point.x : point.y;
    let clearLo = 0;
    let clearHi = 0;
    if (segment.index === 0) clearLo = clearHi = request.endClearance / 2;
    if (segment.index === segments.length - 1) {
      const last = segments[segments.length - 1]!;
      const endsHigh = horizontal ? last.b.x > last.a.x : last.b.y > last.a.y;
      if (endsHigh) clearHi = request.endClearance;
      else clearLo = request.endClearance;
    }
    if (at - span / 2 < lo + clearLo || at + span / 2 > hi - clearHi) return false;
    if (obstacles.some((o) => overlaps(box, o, 2))) return false;
    for (const path of foreignPaths) {
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1]!;
        const b = path[i]!;
        const seg = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) };
        if (overlaps(box, seg, 1)) return false;
      }
    }
    return true;
  };

  const chosen = candidates.find(fits);
  return { center: (chosen ?? candidates[0]!).point, free: chosen !== undefined };
}
