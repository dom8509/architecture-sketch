import type { LEdge, LNode } from "./graph.js";

/**
 * Phase 1 + 2: Ränge je Zone (nur zoneninterne Kanten), Zonen hintereinander gereiht.
 *
 * - Zyklen werden per Tiefensuche in Deklarationsreihenfolge gebrochen; Rückwärtskanten
 *   zählen umgedreht und werden als Rückführung markiert.
 * - Rang = längster Pfad; Quellen rücken an ihren nächsten Nachfolger heran.
 * - Komponenten ganz ohne Verbindung bekommen einen eigenen Rang am Ende ihrer Zone,
 *   damit sie keine bestehende Position verschieben.
 * - Feste Spalten aus `grid`/`hint` sind globale Ränge; die übrigen Knoten ordnen sich darum.
 */
export function assignRanks(nodes: readonly LNode[], edges: readonly LEdge[], zoneCount: number): void {
  const connected = new Set<LNode>();
  for (const edge of edges) {
    connected.add(edge.source);
    connected.add(edge.target);
    if (edge.source.zone > edge.target.zone) edge.feedback = true;
  }

  let offset = 0;
  for (let zone = 0; zone < Math.max(zoneCount, 1); zone++) {
    const members = nodes.filter((n) => n.zone === zone);
    if (members.length === 0) continue;
    const internal = edges.filter((e) => e.source.zone === zone && e.target.zone === zone && e.source !== e.target);

    // ── Zyklen brechen ───────────────────────────────────────
    const outgoing = new Map<LNode, LEdge[]>(members.map((n) => [n, []]));
    for (const e of internal) outgoing.get(e.source)!.push(e);
    const state = new Map<LNode, "active" | "done">();
    const visit = (start: LNode) => {
      // Iterativ, damit tiefe Ketten den Stack nicht sprengen.
      const stack: { node: LNode; next: number }[] = [{ node: start, next: 0 }];
      state.set(start, "active");
      while (stack.length) {
        const frame = stack[stack.length - 1]!;
        const out = outgoing.get(frame.node)!;
        if (frame.next >= out.length) {
          state.set(frame.node, "done");
          stack.pop();
          continue;
        }
        const edge = out[frame.next++]!;
        const s = state.get(edge.target);
        if (s === "active") edge.feedback = true;
        else if (s === undefined) {
          state.set(edge.target, "active");
          stack.push({ node: edge.target, next: 0 });
        }
      }
    };
    for (const n of members) if (!state.has(n)) visit(n);

    // ── DAG ──────────────────────────────────────────────────
    const preds = new Map<LNode, LNode[]>(members.map((n) => [n, []]));
    const succs = new Map<LNode, LNode[]>(members.map((n) => [n, []]));
    for (const e of internal) {
      const [from, to] = e.feedback ? [e.target, e.source] : [e.source, e.target];
      preds.get(to)!.push(from);
      succs.get(from)!.push(to);
    }

    // Topologische Reihenfolge, Gleichstand nach Deklaration.
    const indegree = new Map<LNode, number>(members.map((n) => [n, preds.get(n)!.length]));
    const ready = members.filter((n) => indegree.get(n) === 0);
    const topo: LNode[] = [];
    while (ready.length) {
      ready.sort((a, b) => a.index - b.index);
      const n = ready.shift()!;
      topo.push(n);
      for (const s of succs.get(n)!) {
        indegree.set(s, indegree.get(s)! - 1);
        if (indegree.get(s) === 0) ready.push(s);
      }
    }

    const local = new Map<LNode, number>();
    const fixedLocal = (n: LNode) => (n.fixedRank !== undefined && n.fixedRank >= offset ? n.fixedRank - offset : undefined);
    for (const n of topo) {
      const fixed = fixedLocal(n);
      if (fixed !== undefined) {
        local.set(n, fixed);
        continue;
      }
      let rank = 0;
      for (const p of preds.get(n)!) rank = Math.max(rank, local.get(p)! + 1);
      local.set(n, rank);
    }

    // Kompaktierung: Quellen rücken an ihren nächsten Nachfolger.
    for (const n of [...topo].reverse()) {
      if (preds.get(n)!.length > 0 || succs.get(n)!.length === 0 || fixedLocal(n) !== undefined) continue;
      const nearest = Math.min(...succs.get(n)!.map((s) => local.get(s)!));
      local.set(n, Math.max(local.get(n)!, nearest - 1));
    }

    let last = -1;
    for (const n of members) if (connected.has(n) || fixedLocal(n) !== undefined) last = Math.max(last, local.get(n)!);
    for (const n of members) {
      if (!connected.has(n) && fixedLocal(n) === undefined) local.set(n, last + 1);
    }

    let end = offset;
    for (const n of members) {
      n.rank = offset + local.get(n)!;
      end = Math.max(end, n.rank);
    }
    offset = end + 1;
  }
}
