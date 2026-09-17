# Nach React Flow exportieren

Der React-Flow-Export übergibt ein Diagramm an eine eigene
[React-Flow](https://reactflow.dev)-Anwendung — etwa um es interaktiv darzustellen oder mit
Laufzeitdaten zu verknüpfen. Geometrie und Routing kommen dabei unverändert aus sysarch.

## Exportieren

- **Web-App:** Schaltfläche **React Flow**
- **Obsidian:** Kontextmenü **React Flow JSON exportieren**
- **CLI:** `sysarch render door.arch --format reactflow`

Das Ergebnis ist ein `ReactFlowJsonObject` mit `nodes`, `edges` und `viewport`.

## Was im JSON steht

| sysarch | React Flow |
|---------|------------|
| Komponente | Node; `type` = Template-Name, `position`, `width`, `height` aus dem Layout |
| Pin | Eintrag in `data.pins` mit `id`, `kind`, `side` und `offset` — im Custom Node ein `<Handle id=…>` |
| Verbindung | Edge mit `sourceHandle`/`targetHandle`, `type: "step"`, `data.kind`, `data.direction` und `data.points` |
| Zone, System | Group-Node; Mitglieder haben `parentId` und relative Positionen |
| `count`, `meta` | `data.count`, `data.meta` |

Weitere Details:

- **Körperanschlüsse** (Verbindungen ohne Pin) hängen an virtuellen Handles `__body_left`,
  `__body_right`, `__body_top` bzw. `__body_bottom`.
- **Icons** stehen mit vollständigen Pfaddaten in `data.icon` — die Anwendung braucht keinen
  Zugriff auf die sysarch-Bibliothek.
- **`data.points`** enthält die geroutete Linie. Eine Custom Edge kann sie übernehmen, statt
  neu zu routen.
- Eltern stehen in `nodes` vor ihren Kindern, wie React Flow es verlangt.
- Ausgeblendete Pins (`pins connected`/`none`) fehlen als Handles; die Kante hängt dann am
  Körper-Handle.

## Laden in einer React-Flow-Anwendung

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

`ComponentNode` zeichnet Form, Icon und Label und legt pro Eintrag in `data.pins` einen
`<Handle>` an. Eine vollständige Referenzimplementierung mit Custom Nodes und einer Custom Edge,
die `data.points` übernimmt, liegt im Repository unter
[`apps/reactflow-test`](https://github.com/dom8509/sysarch/tree/main/apps/reactflow-test).

Das vollständige JSON-Format mit Beispiel beschreibt
[05 Rendering & Export](/konzept/05-rendering-export#react-flow-export).
