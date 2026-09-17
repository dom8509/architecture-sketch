import type { Axes, LEdge, LNode, Port } from "./graph.js";

const SWEEPS = 4;

/**
 * Phase 3: Reihenfolge innerhalb der Ränge.
 * Barycenter auf Pin-Ebene, Systeme bleiben je Rang zusammenhängend, Gleichstand →
 * Deklarationsreihenfolge, feste Zeilen aus `grid`/`hint` werden danach eingesetzt.
 */
export function orderLayers(nodes: readonly LNode[], edges: readonly LEdge[], axes: Axes): LNode[][] {
  const rankCount = nodes.reduce((m, n) => Math.max(m, n.rank + n.mainSpan), 0);
  const layers: LNode[][] = Array.from({ length: rankCount }, () => []);
  for (const n of nodes) layers[n.rank]!.push(n);
  layers.forEach((layer) => finish(layer, new Map(layer.map((n) => [n, n.index]))));

  const incident = new Map<LNode, LEdge[]>(nodes.map((n) => [n, []]));
  for (const e of edges) {
    if (e.source === e.target) continue;
    incident.get(e.source)!.push(e);
    incident.get(e.target)!.push(e);
  }

  /** Relative Lage eines Ports quer zur Flussrichtung (0…1). */
  const fraction = (node: LNode, port: Port | undefined): number => {
    if (port?.pin === undefined) return 0.5;
    const size = axes.crossSize(node.box);
    return size > 0 ? axes.portCrossOffset(node, port) / size : 0.5;
  };

  const sweep = (layer: LNode[], towardsLower: boolean) => {
    const keys = new Map<LNode, number>();
    for (const node of layer) {
      let sum = 0;
      let weight = 0;
      for (const e of incident.get(node)!) {
        const isSource = e.source === node;
        const other = isSource ? e.target : e.source;
        if (towardsLower ? other.rank >= node.rank : other.rank <= node.rank) continue;
        const own = fraction(node, isSource ? e.sourcePort : e.targetPort);
        const theirs = fraction(other, isSource ? e.targetPort : e.sourcePort);
        sum += e.weight * (other.order + theirs - own);
        weight += e.weight;
      }
      keys.set(node, weight > 0 ? sum / weight : node.order);
    }
    finish(layer, keys);
  };

  for (let i = 0; i < SWEEPS; i++) {
    for (let r = 1; r < rankCount; r++) sweep(layers[r]!, true);
    for (let r = rankCount - 2; r >= 0; r--) sweep(layers[r]!, false);
  }
  return layers;
}

interface Cluster {
  key: number;
  first: number;
  nodes: LNode[];
}

/** Sortiert einen Rang hierarchisch nach Systemen, setzt feste Zeilen ein und nummeriert. */
function finish(layer: LNode[], keys: Map<LNode, number>): void {
  const sortLevel = (members: LNode[], depth: number): LNode[] => {
    const clusters: Cluster[] = [];
    const bySystem = new Map<string, LNode[]>();
    for (const n of members) {
      const system = n.systems[depth];
      if (system === undefined) {
        clusters.push({ key: keys.get(n)!, first: n.index, nodes: [n] });
      } else if (bySystem.has(system)) {
        bySystem.get(system)!.push(n);
      } else {
        const group = [n];
        bySystem.set(system, group);
        clusters.push({ key: 0, first: n.index, nodes: group });
      }
    }
    for (const c of clusters) {
      if (c.nodes.length === 1 && c.nodes[0]!.systems[depth] === undefined) continue;
      c.nodes = sortLevel(c.nodes, depth + 1);
      c.key = c.nodes.reduce((s, n) => s + keys.get(n)!, 0) / c.nodes.length;
      c.first = Math.min(...c.nodes.map((n) => n.index));
    }
    clusters.sort((a, b) => a.key - b.key || a.first - b.first);
    return clusters.flatMap((c) => c.nodes);
  };

  const sorted = sortLevel(layer, 0);
  const fixed = sorted.filter((n) => n.fixedSlot !== undefined).sort((a, b) => a.fixedSlot! - b.fixedSlot! || a.index - b.index);
  const free = sorted.filter((n) => n.fixedSlot === undefined);
  const result: LNode[] = [];
  let f = 0;
  for (const n of fixed) {
    while (result.length < n.fixedSlot! && f < free.length) result.push(free[f++]!);
    result.push(n);
  }
  while (f < free.length) result.push(free[f++]!);

  layer.length = 0;
  result.forEach((n, i) => {
    n.order = i;
    layer.push(n);
  });
}
