import { compile, hasErrors } from "@sysarch/core";
import { toReactFlow, type GroupNode, type ReactFlowExport } from "@sysarch/export-reactflow";
import { architectureScene } from "@sysarch/render-svg";
import {
  Background, Controls, ReactFlow, ReactFlowProvider,
  type Edge, type EdgeTypes, type Node, type NodeProps, type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { StrictMode, useMemo, useRef, useState, type ChangeEvent } from "react";
import { createRoot } from "react-dom/client";
import { SysarchEdge, SysarchNode } from "./nodes.tsx";
import "./style.css";

const examples: Record<string, string> = Object.fromEntries(
  Object.entries(import.meta.glob<string>("../../../examples/*.arch", { query: "?raw", import: "default", eager: true }))
    .map(([path, source]): [string, string] => [path.slice(path.lastIndexOf("/") + 1), source])
    .sort(([a], [b]) => a.localeCompare(b)),
);

function exportExample(name: string): ReactFlowExport {
  const { value, diagnostics } = compile(examples[name]!);
  if (hasErrors(diagnostics)) throw new Error(`${name} enthält Fehler`);
  return toReactFlow(value, architectureScene(value));
}

function GroupFrame({ data }: NodeProps<Node<GroupNode["data"] & Record<string, unknown>>>) {
  return <div className={`sa-group sa-${data.groupType}`}><span className="sa-group-label">{data.label}</span></div>;
}

const edgeTypes: EdgeTypes = { step: SysarchEdge };

interface Status {
  errors: string[];
  nodes: number;
  edges: number;
}

function App() {
  const [name, setName] = useState("zonal-ecu.arch");
  const [flow, setFlow] = useState<ReactFlowExport>(() => exportExample(name));
  const errors = useRef<string[]>([]);
  const [status, setStatus] = useState<Status>();

  /** Zählt nach dem Initialisieren, ob React Flow jeden Knoten und jede Kante gezeichnet hat. */
  const measure = () => requestAnimationFrame(() => setStatus({
    errors: [...errors.current],
    nodes: document.querySelectorAll(".react-flow__node").length,
    edges: document.querySelectorAll(".react-flow__edge").length,
  }));

  const nodeTypes = useMemo<NodeTypes>(() => {
    const types: NodeTypes = { group: GroupFrame };
    for (const node of flow.nodes) if (node.type !== "group") types[node.type] = SysarchNode;
    return types;
  }, [flow]);

  const show = (nextName: string, nextFlow: ReactFlowExport) => {
    errors.current = [];
    setStatus(undefined);
    setName(nextName);
    setFlow(nextFlow);
  };

  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) show(file.name, JSON.parse(await file.text()) as ReactFlowExport);
  };

  const expected = { nodes: flow.nodes.length, edges: flow.edges.length };
  const ok = status && status.errors.length === 0 && status.nodes === expected.nodes && status.edges === expected.edges;

  return (
    <div className="app">
      <header>
        <strong>sysarch → React Flow</strong>
        <select value={examples[name] ? name : ""} onChange={(e) => show(e.target.value, exportExample(e.target.value))}>
          {!examples[name] && <option value="">{name}</option>}
          {Object.keys(examples).map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <label>JSON laden <input type="file" accept=".json" onChange={upload} /></label>
        <output id="status" data-ok={status ? String(ok) : undefined}>
          {status
            ? `${ok ? "✓" : "✗"} ${status.nodes}/${expected.nodes} Knoten, ${status.edges}/${expected.edges} Kanten, ${status.errors.length} Fehler`
            : "lädt…"}
          {status?.errors.map((e) => <div key={e} className="error">{e}</div>)}
        </output>
      </header>
      <ReactFlowProvider key={name}>
        <ReactFlow
          nodes={flow.nodes as Node[]}
          edges={flow.edges as Edge[]}
          defaultViewport={flow.viewport}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodesDraggable={false}
          fitView
          onInit={measure}
          onError={(code, message) => errors.current.push(`${code}: ${message}`)}
        >
          <Background />
          <Controls showInteractive={false} />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
