import {
  SIDES, SIGNAL_GROUPS, stackIdentical,
  type ArchitectureModel, type Category, type IconDef, type Importance, type Shape, type Side, type SignalKind, type Size,
} from "@sysarch/core";
import type { Point, Rect, SceneGraph, SceneMarker, ScenePath, SceneRect, SceneShape } from "@sysarch/layout";

// Typen spiegeln `ReactFlowJsonObject` aus @xyflow/react, ohne davon abzuhängen (D16).

export interface ReactFlowExport {
  nodes: (ComponentNode | GroupNode)[];
  edges: ConnectionEdge[];
  viewport: { x: number; y: number; zoom: number };
}

export interface XY {
  x: number;
  y: number;
}

export interface GroupNode {
  id: string;
  type: "group";
  parentId?: string;
  extent?: "parent";
  /** Relativ zum Elternknoten, sonst absolut. */
  position: XY;
  style: { width: number; height: number };
  data: { label: string; groupType: "zone" | "system" };
}

export interface ComponentNode {
  id: string;
  /** Template-Name; die Zielanwendung registriert dafür einen Custom Node. */
  type: string;
  parentId?: string;
  extent?: "parent";
  position: XY;
  width: number;
  height: number;
  data: ComponentData;
}

export interface ComponentData {
  label: string;
  category: Category;
  importance: Importance;
  size: Size;
  /** Form der Hülle; `pins[].offset` bezieht sich auf die Hülle. */
  shape: Shape;
  /** Vollständige Pfaddaten, damit die Zielanwendung ohne sysarch-Bibliothek auskommt. */
  icon?: IconDef;
  /** Anzahl gleicher Elemente (`count`); fehlt bei 1. Die Hülle umfasst den ganzen Stapel. */
  count?: number;
  pins: PinData[];
  meta: Record<string, string>;
}

export interface PinData {
  /** Handle-ID im Custom Node. */
  id: string;
  label: string;
  kind: SignalKind;
  side: Side;
  /** Entlang der Seite ab der linken bzw. oberen Ecke der Hülle, in px. */
  offset: number;
}

export interface ConnectionEdge {
  id: string;
  source: string;
  /** Pin-Name oder virtueller Körperanschluss `__body_<side>`. */
  sourceHandle: string;
  target: string;
  targetHandle: string;
  type: "step";
  label?: string;
  markerStart?: { type: "arrowclosed" };
  markerEnd?: { type: "arrowclosed" };
  className: string;
  data: {
    kind: SignalKind;
    direction: "forward" | "bidirectional" | "none";
    /** Geroutete Geometrie in absoluten Koordinaten, damit eine Custom Edge nicht neu routet. */
    points: [number, number][];
  };
}

/** Handle-ID eines Körperanschlusses (Verbindung ohne Pin). */
export function bodyHandle(side: Side): string {
  return `__body_${side}`;
}

/**
 * Semantic Model + Scene Graph → React-Flow-JSON. Reine Funktion, deterministisch; die
 * Geometrie kommt vollständig aus dem Scene Graph, damit sie dem SVG entspricht.
 * Eltern stehen in `nodes` vor ihren Kindern, wie React Flow es verlangt.
 */
export function toReactFlow(source: ArchitectureModel, scene: SceneGraph): ReactFlowExport {
  // Dieselbe Sicht wie das Layout: zusammengefasste Komponenten erscheinen einmal mit `count`.
  const model = stackIdentical(source);
  const shapes = new Map<string, SceneShape>();
  const frames = new Map<string, SceneRect>();
  const pins = new Map<string, SceneMarker>();
  const paths = new Map<string, ScenePath>();
  for (const item of scene.items) {
    if (!item.ref) continue;
    if (item.type === "shape") shapes.set(item.ref, item);
    else if (item.type === "rect") frames.set(item.ref, item);
    else if (item.type === "marker" && item.shape === "pin") pins.set(item.ref, item);
    else if (item.type === "path" && item.ref.startsWith("connection:")) paths.set(item.ref, item);
  }
  const icons = new Map(scene.icons.map((icon) => [icon.name, icon]));

  const nodes: ReactFlowExport["nodes"] = [];
  const hulls = new Map<string, Rect>();
  const parented = (parent: Rect | undefined, parentId: string | undefined, rect: Rect) => ({
    ...(parentId !== undefined && { parentId, extent: "parent" as const }),
    position: { x: round(rect.x - (parent?.x ?? 0)), y: round(rect.y - (parent?.y ?? 0)) },
  });

  const visit = (children: readonly string[], parentId: string | undefined, parent: Rect | undefined) => {
    for (const id of children) {
      const group = model.groups.get(id);
      if (group && group.type !== "root") {
        const frame = frames.get(`${group.type}:${id}`);
        if (!frame) continue;
        nodes.push({
          id,
          type: "group",
          ...parented(parent, parentId, frame),
          style: { width: round(frame.width), height: round(frame.height) },
          data: { label: group.label ?? id, groupType: group.type },
        });
        visit(group.children, id, frame);
        continue;
      }
      const component = model.components.get(id);
      const hull = shapes.get(`component:${id}`);
      if (!component || !hull) continue;
      hulls.set(id, hull);
      const icon = component.icon === undefined ? undefined : icons.get(component.icon);
      nodes.push({
        id,
        type: component.template,
        ...parented(parent, parentId, hull),
        width: round(hull.width),
        height: round(hull.height),
        data: {
          label: component.label,
          category: component.category,
          importance: component.importance,
          size: component.size,
          shape: component.shape,
          ...(icon && { icon }),
          ...(component.count > 1 && { count: component.count }),
          pins: component.pins.flatMap((pin) => {
            const marker = pins.get(`pin:${id}.${pin.name}`);
            if (!marker) return [];
            const side = sideOfAngle(marker.angle);
            const offset = side === "left" || side === "right" ? marker.y - hull.y : marker.x - hull.x;
            return [{ id: pin.name, label: pin.label, kind: pin.kind, side, offset: round(offset) }];
          }),
          meta: { ...component.meta },
        },
      });
    }
  };
  visit(model.root.children, undefined, undefined);

  // Ausgeblendete Pins (`pins connected|none`) haben keinen Handle; die Kante hängt am Körper.
  const handle = (component: string, pin: string | undefined) =>
    pin !== undefined && pins.has(`pin:${component}.${pin}`) ? pin : undefined;
  const edges: ConnectionEdge[] = [];
  for (const c of model.connections) {
    const path = paths.get(`connection:${c.id}`);
    const source = hulls.get(c.source.component);
    const target = hulls.get(c.target.component);
    if (!path || !source || !target || path.points.length < 2) continue;
    const first = path.points[0]!;
    const last = path.points[path.points.length - 1]!;
    const arrow = { type: "arrowclosed" as const };
    edges.push({
      id: c.id,
      source: c.source.component,
      sourceHandle: handle(c.source.component, c.source.pin) ?? bodyHandle(nearestSide(source, first)),
      target: c.target.component,
      targetHandle: handle(c.target.component, c.target.pin) ?? bodyHandle(nearestSide(target, last)),
      type: "step",
      ...(c.label && { label: c.label }),
      ...(c.direction === "bidirectional" && { markerStart: arrow }),
      ...(c.direction !== "none" && { markerEnd: arrow }),
      className: `sa-edge sa-group-${SIGNAL_GROUPS[c.kind]} sa-kind-${c.kind}`,
      data: {
        kind: c.kind,
        direction: c.direction,
        points: path.points.map((p) => [round(p.x), round(p.y)]),
      },
    });
  }

  return { nodes, edges, viewport: { x: 0, y: 0, zoom: 1 } };
}

function sideOfAngle(angle: SceneMarker["angle"]): Side {
  return angle === 0 ? "right" : angle === 90 ? "bottom" : angle === 180 ? "left" : "top";
}

/** Seite der Hülle, an der ein Routenende liegt. */
function nearestSide(hull: Rect, p: Point): Side {
  const distance: Record<Side, number> = {
    left: Math.abs(p.x - hull.x),
    right: Math.abs(p.x - (hull.x + hull.width)),
    top: Math.abs(p.y - hull.y),
    bottom: Math.abs(p.y - (hull.y + hull.height)),
  };
  return SIDES.reduce((best, side) => (distance[side] < distance[best] ? side : best));
}

function round(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}
