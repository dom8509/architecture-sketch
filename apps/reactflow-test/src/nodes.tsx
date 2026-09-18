import { BaseEdge, Handle, Position, type Edge, type EdgeProps, type Node, type NodeProps } from "@xyflow/react";
import type { ComponentData, ConnectionEdge, PinData } from "@sysarch/export-reactflow";

// Custom node and custom edge as a consuming application would write them: purely from the
// exported JSON, without access to the sysarch library.

const POSITIONS = { left: Position.Left, right: Position.Right, top: Position.Top, bottom: Position.Bottom } as const;
type Side = keyof typeof POSITIONS;

/** Every port is source and target at once — the direction lives on the edge. */
function Port({ id, side, offset, className }: { id: string; side: Side; offset?: number; className: string }) {
  const along = offset === undefined ? "50%" : offset;
  const style = side === "left" || side === "right" ? { top: along } : { left: along };
  return (
    <>
      <Handle id={id} type="source" position={POSITIONS[side]} style={style} className={className} isConnectable={false} />
      <Handle id={id} type="target" position={POSITIONS[side]} style={style} className={className} isConnectable={false} />
    </>
  );
}

function outline(shape: ComponentData["shape"], w: number, h: number): string {
  switch (shape) {
    case "circle": {
      const r = Math.min(w, h) / 2 - 1;
      return `M${w / 2 - r} ${h / 2}a${r} ${r} 0 1 1 ${2 * r} 0a${r} ${r} 0 1 1 ${-2 * r} 0Z`;
    }
    case "hexagon":
      return `M1 ${h / 2}L${h / 4} 1H${w - h / 4}L${w - 1} ${h / 2}L${w - h / 4} ${h - 1}H${h / 4}Z`;
    case "cylinder":
      return `M1 9A${w / 2 - 1} 8 0 0 1 ${w - 1} 9V${h - 9}A${w / 2 - 1} 8 0 0 1 1 ${h - 9}ZM1 9A${w / 2 - 1} 8 0 0 0 ${w - 1} 9`;
    case "rect":
      return `M1 1H${w - 1}V${h - 1}H1Z`;
    case "rounded":
      return `M9 1H${w - 9}Q${w - 1} 1 ${w - 1} 9V${h - 9}Q${w - 1} ${h - 1} ${w - 9} ${h - 1}H9Q1 ${h - 1} 1 ${h - 9}V9Q1 1 9 1Z`;
  }
}

export function SysarchNode({ data, width = 0, height = 0 }: NodeProps<Node<ComponentData & Record<string, unknown>>>) {
  return (
    <div className={`sa-node sa-cat-${data.category} sa-importance-${data.importance}`} style={{ width, height }}>
      <svg className="sa-node-shape" width={width} height={height}>
        <path d={outline(data.shape, width, height)} />
      </svg>
      <div className="sa-node-body">
        {data.icon && (
          <svg className="sa-node-icon" viewBox={data.icon.viewBox}>
            {data.icon.elements.map((e, i) => (
              <path key={i} d={e.d} className={e.mode === "fill" ? "sa-fill" : "sa-stroke"} />
            ))}
          </svg>
        )}
        <span className="sa-node-label">{data.label}</span>
      </div>
      {data.pins.map((pin: PinData) => (
        <span key={pin.id}>
          <Port id={pin.id} side={pin.side} offset={pin.offset} className={`sa-pin sa-kind-${pin.kind}`} />
          <span className={`sa-pin-label sa-side-${pin.side}`} style={pin.side === "left" || pin.side === "right" ? { top: pin.offset } : { left: pin.offset }}>
            {pin.label}
          </span>
        </span>
      ))}
      {(["left", "right", "top", "bottom"] as const).map((side) => (
        <Port key={side} id={`__body_${side}`} side={side} className="sa-body-handle" />
      ))}
    </div>
  );
}

type EdgeData = ConnectionEdge["data"] & Record<string, unknown>;

/** Takes the routed geometry from `data.points` instead of routing itself. */
export function SysarchEdge({ id, data, label, markerStart, markerEnd, style }: EdgeProps<Edge<EdgeData>>) {
  const points = data?.points ?? [];
  const path = points.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join("");
  let labelX = 0;
  let labelY = 0;
  let longest = -1;
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1]!;
    const [bx, by] = points[i]!;
    const length = Math.abs(bx - ax) + Math.abs(by - ay);
    if (length > longest) [longest, labelX, labelY] = [length, (ax + bx) / 2, (ay + by) / 2];
  }
  return <BaseEdge id={id} path={path} label={label} labelX={labelX} labelY={labelY} markerStart={markerStart} markerEnd={markerEnd} style={style} />;
}
