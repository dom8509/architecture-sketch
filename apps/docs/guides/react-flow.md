# Exporting to React Flow

The React Flow export hands a diagram over to your own
[React Flow](https://reactflow.dev) application — to display it interactively, for example, or
to tie it to runtime data. Geometry and routing come straight from sysarch, unchanged.

## Exporting

- **Web app:** the **React Flow** button
- **Obsidian:** the context menu entry **Export React Flow JSON**
- **CLI:** `sysarch render door.arch --format reactflow`

The result is a `ReactFlowJsonObject` with `nodes`, `edges` and `viewport`.

## What the JSON contains

| sysarch | React Flow |
|---------|------------|
| component | node; `type` = template name, `position`, `width`, `height` from the layout |
| pin | entry in `data.pins` with `id`, `kind`, `side` and `offset` — a `<Handle id=…>` in the custom node |
| connection | edge with `sourceHandle`/`targetHandle`, `type: "step"`, `data.kind`, `data.direction` and `data.points` |
| zone, system | group node; members carry `parentId` and relative positions |
| `count`, `meta` | `data.count`, `data.meta` |

A few more details:

- **Body connections** (connections without a pin) attach to the virtual handles
  `__body_left`, `__body_right`, `__body_top` and `__body_bottom`.
- **Icons** are included with their full path data in `data.icon` — the application needs no
  access to the sysarch library.
- **`data.points`** holds the routed line. A custom edge can adopt it instead of routing
  again.
- Parents come before their children in `nodes`, as React Flow requires.
- Hidden pins (`pins connected`/`none`) are missing as handles; the edge then attaches to the
  body handle.

## Loading it in a React Flow application

```tsx
import { ReactFlow, type Edge, type Node } from "@xyflow/react";
import flow from "./door.reactflow.json";

const nodeTypes = { microcontroller: ComponentNode, half_bridge: ComponentNode /* … */ };

export function Architecture() {
  return (
    <ReactFlow
      nodes={flow.nodes as Node[]}
      edges={flow.edges as Edge[]}
      nodeTypes={nodeTypes}
      fitView
    />
  );
}
```

`ComponentNode` draws shape, icon and label and creates one `<Handle>` per entry in
`data.pins`. A complete reference implementation with custom nodes and a custom edge that
adopts `data.points` lives in the repository under
[`apps/reactflow-test`](https://github.com/dom8509/sysarch/tree/main/apps/reactflow-test).

The full JSON format, with an example, is described in
[05 Rendering & Export](/concept/05-rendering-export#react-flow-export).
