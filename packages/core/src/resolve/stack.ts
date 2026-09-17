import type { ArchitectureModel, Component, ComponentId, Connection, Group } from "./index.js";

/**
 * `stack identical`: Gleich verschaltete Komponenten werden zu einem Mehrfachelement
 * zusammengefasst. Liefert bei `stack none` das Modell unverändert zurück.
 *
 * Gleich verschaltet heißt: gleicher Namensstamm (Label ohne laufende Nummer, siehe `labelStem`),
 * gleiche Eigenschaften (Template, Gruppe, Form, Pins, …) und
 * Verbindungen gleicher Art, Richtung und Beschriftung zu Gegenstellen, die ihrerseits gleich
 * verschaltet sind. Berechnet per Partitionsverfeinerung, deshalb fassen sich auch Ketten
 * zusammen (`hb1 → m1 … hb4 → m4` ergibt `hb ×4 → m ×4`).
 *
 * Die erste Komponente einer Klasse (Deklarationsreihenfolge) bleibt stehen, erhält die Summe
 * der Anzahlen und das gemeinsame Label; Verbindungen der übrigen fallen auf sie zurück,
 * Duplikate entfallen. Grid-Zellen entfernter Komponenten werden leer.
 */
export function stackIdentical(model: ArchitectureModel): ArchitectureModel {
  if (model.stack !== "identical") return model;
  const components = [...model.components.values()];

  // ── Klassen ──────────────────────────────────────────────────
  const numbering = (keys: string[]) => {
    const ids = new Map<string, number>();
    return keys.map((k) => {
      if (!ids.has(k)) ids.set(k, ids.size);
      return ids.get(k)!;
    });
  };
  let classes = numbering(components.map(localKey));
  const indexOf = new Map(components.map((c, i) => [c.id, i]));
  for (;;) {
    const cls = (id: ComponentId) => classes[indexOf.get(id)!]!;
    const edges = components.map(() => [] as string[]);
    for (const c of model.connections) {
      const s = indexOf.get(c.source.component);
      const t = indexOf.get(c.target.component);
      if (s === undefined || t === undefined) continue;
      const rest = `${c.kind}|${c.direction}|${c.label ?? ""}`;
      edges[s]!.push(`out|${c.source.pin ?? ""}|${cls(c.target.component)}|${c.target.pin ?? ""}|${rest}`);
      edges[t]!.push(`in|${c.target.pin ?? ""}|${cls(c.source.component)}|${c.source.pin ?? ""}|${rest}`);
    }
    const refined = numbering(components.map((_, i) => `${classes[i]}#${edges[i]!.sort().join("\n")}`));
    const stable = Math.max(-1, ...refined) === Math.max(-1, ...classes);
    classes = refined;
    if (stable) break;
  }

  // ── Zusammenfassen ───────────────────────────────────────────
  const members = new Map<number, Component[]>();
  components.forEach((c, i) => {
    if (!members.has(classes[i]!)) members.set(classes[i]!, []);
    members.get(classes[i]!)!.push(c);
  });
  const repOf = new Map<ComponentId, ComponentId>();
  const merged = new Map<ComponentId, Component>();
  for (const list of members.values()) {
    const first = list[0]!;
    for (const c of list) repOf.set(c.id, first.id);
    merged.set(first.id, list.length === 1 ? first : {
      ...first,
      label: labelStem(first.label),
      count: list.reduce((sum, c) => sum + c.count, 0),
    });
  }
  if (merged.size === components.length) return model;

  const result = new Map<ComponentId, Component>();
  for (const c of components) if (repOf.get(c.id) === c.id) result.set(c.id, merged.get(c.id)!);

  const seen = new Set<string>();
  const connections: Connection[] = [];
  for (const c of model.connections) {
    const source = { ...c.source, component: repOf.get(c.source.component) ?? c.source.component };
    const target = { ...c.target, component: repOf.get(c.target.component) ?? c.target.component };
    const key = [source.component, source.pin, target.component, target.pin, c.kind, c.direction, c.label].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    connections.push({ ...c, source, target });
  }

  const keep = (id: string) => !repOf.has(id) || repOf.get(id) === id;
  const prune = (g: Group): Group => ({ ...g, children: g.children.filter(keep) });
  const groups = new Map([...model.groups].map(([id, g]) => [id, prune(g)]));

  return {
    ...model,
    components: result,
    connections,
    root: prune(model.root),
    groups,
    ...(model.grid && { grid: { ...model.grid, rows: model.grid.rows.map((row) => row.map((id) => (id !== null && keep(id) ? id : null))) } }),
  };
}

/** Alles außer laufender Nummer im Label und Layout-Hinweisen muss übereinstimmen. */
function localKey(c: Component): string {
  return JSON.stringify([
    labelStem(c.label), c.template, c.groupPath, c.shape, c.icon ?? "", c.category, c.size, c.importance, c.count,
    c.pins.map((p) => [p.name, p.kind, p.side, p.label]),
    Object.entries(c.meta).sort(([a], [b]) => a.localeCompare(b)),
  ]);
}

/**
 * Label ohne laufende Nummer: „Half Bridge 3“ → „Half Bridge“, „HB1“ → „HB“, „Strom B“ → „Strom“.
 * Als Nummer gelten höchstens zwei Ziffern (Teilenummern wie „S32K344“ bleiben ganz) und
 * Einzelbuchstaben mit Trennzeichen davor. Unterschiedliche Stämme („Temperatur“, „Strom“)
 * werden nie zusammengefasst.
 */
export function labelStem(label: string): string {
  const stem = label.replace(/(?:(?<!\d)[\s_\-#.:/]*\d{1,2}|[\s_\-#.:/]+[A-Za-z])$/, "");
  return stem.length > 0 ? stem : label;
}
