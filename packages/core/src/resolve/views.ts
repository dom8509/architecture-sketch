import type {
  ArchitectureModel, Component, ComponentId, Connection, Group, GroupId, Pin,
} from "./index.js";

/**
 * Visibility of the elements per view. An element without `show in` is shown in every view
 * its parent is shown in; `show in` narrows that set, it never widens it. The tree therefore
 * decides: a pin is never visible without its component, a component never without its zone.
 */
export class Visibility {
  private readonly all: string[];
  private readonly groups = new Map<GroupId, string[]>();

  constructor(private readonly model: ArchitectureModel) {
    this.all = model.views.map((v) => v.id);
    const walk = (group: Group, inherited: string[]) => {
      const views = narrow(inherited, group.views);
      this.groups.set(group.id, views);
      for (const child of group.children) {
        const sub = model.groups.get(child);
        if (sub) walk(sub, views);
      }
    };
    walk(model.root, this.all);
  }

  /** Views of a component, taking its zone and systems into account. */
  component(component: Component): string[] {
    const parent = component.groupPath.at(-1);
    return narrow(parent === undefined ? this.all : this.groups.get(parent) ?? this.all, component.views);
  }

  pin(component: Component, pin: Pin): string[] {
    return narrow(this.component(component), pin.views);
  }

  group(id: GroupId): string[] {
    return this.groups.get(id) ?? this.all;
  }

  /** A connection needs both of its components; `show in` narrows further. */
  connection(connection: Connection): string[] {
    const source = this.model.components.get(connection.source.component);
    const target = this.model.components.get(connection.target.component);
    if (!source || !target) return [];
    const both = this.component(source).filter((v) => this.component(target).includes(v));
    return narrow(both, connection.views);
  }
}

const narrow = (inherited: readonly string[], declared: readonly string[] | undefined): string[] =>
  declared === undefined ? [...inherited] : inherited.filter((v) => declared.includes(v));

/**
 * The model reduced to one view: everything the view does not show is dropped. Connections to a
 * hidden pin dock on the body of the component, as with `pins none`. A model without views, or
 * an unknown view id, comes back unchanged.
 */
export function projectView(model: ArchitectureModel, viewId: string): ArchitectureModel {
  if (!model.views.some((v) => v.id === viewId)) return model;
  const visibility = new Visibility(model);

  const components = new Map<ComponentId, Component>();
  const visiblePins = new Set<string>();
  for (const component of model.components.values()) {
    if (!visibility.component(component).includes(viewId)) continue;
    const pins = component.pins.filter((pin) => visibility.pin(component, pin).includes(viewId));
    for (const pin of pins) visiblePins.add(`${component.id}.${pin.name}`);
    components.set(component.id, {
      ...component,
      pins,
      groupPath: component.groupPath.filter((id) => visibility.group(id).includes(viewId)),
    });
  }

  const dock = (endpoint: Connection["source"]) =>
    endpoint.pin !== undefined && !visiblePins.has(`${endpoint.component}.${endpoint.pin}`)
      ? { component: endpoint.component }
      : endpoint;

  const connections = model.connections
    .filter((connection) => visibility.connection(connection).includes(viewId))
    .map((connection) => ({ ...connection, source: dock(connection.source), target: dock(connection.target) }));

  // Groups without visible content disappear, and with them their entries in the parent.
  const groups = new Map<GroupId, Group>();
  const keep = (id: GroupId): boolean => {
    const group = model.groups.get(id);
    if (!group || !visibility.group(id).includes(viewId)) return false;
    const children = group.children.filter((child) =>
      model.groups.has(child) ? keep(child) : components.has(child));
    if (children.length === 0) return false;
    groups.set(id, { ...group, children });
    return true;
  };
  const rootChildren = model.root.children.filter((child) =>
    model.groups.has(child) ? keep(child) : components.has(child));

  const projected: ArchitectureModel = {
    ...model,
    components,
    connections,
    groups,
    root: { ...model.root, children: rootChildren },
    views: model.views,
  };
  if (model.grid) projected.grid = { ...model.grid, rows: compact(model.grid.rows, components) };
  return projected;
}

/** Grid of the view: cells of hidden components become empty, empty rows and columns drop out. */
function compact(
  rows: readonly (ComponentId | null)[][],
  components: ReadonlyMap<ComponentId, Component>,
): (ComponentId | null)[][] {
  const kept = rows.map((row) => row.map((cell) => (cell !== null && components.has(cell) ? cell : null)));
  const width = Math.max(0, ...kept.map((row) => row.length));
  const columns = [...Array(width).keys()].filter((k) => kept.some((row) => row[k] != null));
  return kept.filter((row) => row.some((cell) => cell !== null)).map((row) => columns.map((k) => row[k] ?? null));
}
