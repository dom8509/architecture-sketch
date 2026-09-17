import { readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compile, SIDES } from "@sysarch/core";
import { layout } from "@sysarch/layout";
import { getTheme } from "@sysarch/themes";
import { describe, expect, it } from "vitest";
import { bodyHandle, toReactFlow, type ComponentNode, type ReactFlowExport } from "../src/index.js";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const examples = readdirSync(join(root, "examples")).filter((f) => f.endsWith(".arch")).sort();

function exportSource(source: string): ReactFlowExport {
  const { value, diagnostics } = compile(source);
  expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  return toReactFlow(value, layout(value, getTheme(value.theme)));
}

const exportExample = (file: string) => exportSource(readFileSync(join(root, "examples", file), "utf8"));

/** Absolute Position eines Knotens über die Elternkette. */
function absolute(flow: ReactFlowExport, id: string): { x: number; y: number } {
  const node = flow.nodes.find((n) => n.id === id)!;
  const parent = node.parentId === undefined ? { x: 0, y: 0 } : absolute(flow, node.parentId);
  return { x: parent.x + node.position.x, y: parent.y + node.position.y };
}

const size = (n: ReactFlowExport["nodes"][number]) =>
  "style" in n ? n.style : { width: n.width, height: n.height };

describe("React-Flow-Export", () => {
  // Aktualisieren: `npx vitest run -u`
  for (const file of examples) {
    const name = basename(file, ".arch");
    it(`${name} entspricht dem Golden File`, async () => {
      await expect(JSON.stringify(exportExample(file), null, 2) + "\n")
        .toMatchFileSnapshot(join(root, "tests", "golden", `${name}.reactflow.json`));
    });

    it(`${name} ist ladbar: Eltern zuerst, Handles vorhanden, Geometrie passt`, () => {
      const flow = exportExample(file);
      const ids = flow.nodes.map((n) => n.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(new Set(flow.edges.map((e) => e.id)).size).toBe(flow.edges.length);

      flow.nodes.forEach((node, index) => {
        if (node.parentId === undefined) return;
        const parentIndex = ids.indexOf(node.parentId);
        expect(parentIndex, `${node.id}: Elternknoten vor dem Kind`).toBeGreaterThanOrEqual(0);
        expect(parentIndex).toBeLessThan(index);
        const parent = size(flow.nodes[parentIndex]!);
        const own = size(node);
        expect(node.position.x).toBeGreaterThanOrEqual(0);
        expect(node.position.y).toBeGreaterThanOrEqual(0);
        expect(node.position.x + own.width).toBeLessThanOrEqual(parent.width);
        expect(node.position.y + own.height).toBeLessThanOrEqual(parent.height);
      });

      for (const edge of flow.edges) {
        for (const end of ["source", "target"] as const) {
          const node = flow.nodes.find((n) => n.id === edge[end]) as ComponentNode | undefined;
          expect(node, `${edge.id}: ${end}`).toBeDefined();
          const handle = end === "source" ? edge.sourceHandle : edge.targetHandle;
          const [px, py] = end === "source" ? edge.data.points[0]! : edge.data.points[edge.data.points.length - 1]!;
          const at = absolute(flow, node!.id);
          const pin = node!.data.pins.find((p) => p.id === handle);
          if (pin) {
            const expected = pin.side === "left" ? [at.x, at.y + pin.offset]
              : pin.side === "right" ? [at.x + node!.width, at.y + pin.offset]
              : pin.side === "top" ? [at.x + pin.offset, at.y]
              : [at.x + pin.offset, at.y + node!.height];
            expect([px, py], `${edge.id}: Route endet am Pin ${handle}`).toEqual(expected);
          } else {
            expect(SIDES.map(bodyHandle), `${edge.id}: Handle ${handle}`).toContain(handle);
          }
        }
      }
    });
  }

  it("exportiert bei stack identical dieselbe Sicht wie das Bild", () => {
    const flow = exportSource(`architecture "A" {
    stack identical
    component mcu: microcontroller
    component l1: load { label "Lamp 1" }
    component l2: load { label "Lamp 2" }
    mcu -> l1
    mcu -> l2
}
`);
    expect(flow.nodes.map((n) => n.id)).toEqual(["mcu", "l1"]);
    expect((flow.nodes[1] as ComponentNode).data).toMatchObject({ label: "Lamp", count: 2 });
    expect(flow.edges).toHaveLength(1);
  });

  it("exportiert count nur bei Mehrfachelementen", () => {
    const flow = exportSource(`architecture "A" {
    component a { count 3 }
    component b
}
`);
    const [a, b] = flow.nodes as ComponentNode[];
    expect(a!.data.count).toBe(3);
    expect("count" in b!.data).toBe(false);
  });

  it("hängt Kanten an ausgeblendeten Pins an den Körper", () => {
    const flow = exportSource(`architecture "A" {
    pins none
    component psu: power_supply
    component mcu: microcontroller { pin power VDD }
    psu.VOUT -> mcu.VDD
}
`);
    const [edge] = flow.edges;
    expect(SIDES.map(bodyHandle)).toContain(edge!.sourceHandle);
    expect(SIDES.map(bodyHandle)).toContain(edge!.targetHandle);
    for (const node of flow.nodes as ComponentNode[]) expect(node.data.pins).toEqual([]);
  });

  it("bildet Körperanschlüsse, Richtungen und Metadaten ab", () => {
    const flow = exportSource(`architecture "A" {
    zone z {
        label "Zone"
        system s {
            component a: microcontroller {
                pin can CAN_TX
                meta { part "S32K344" }
            }
        }
    }
    zone y {
        component b
        component c
    }
    a.CAN_TX <-> b
    b -- c
}
`);
    expect(flow.nodes.map((n) => [n.id, n.type, n.parentId])).toEqual([
      ["z", "group", undefined], ["s", "group", "z"], ["a", "microcontroller", "s"], ["y", "group", undefined], ["b", "block", "y"], ["c", "block", "y"],
    ]);
    const a = flow.nodes[2] as ComponentNode;
    expect(a.data).toMatchObject({ category: "controller", meta: { part: "S32K344" }, icon: { name: "chip" } });
    const [ab, bc] = flow.edges;
    expect(ab).toMatchObject({
      sourceHandle: "CAN_TX", targetHandle: "__body_left",
      markerStart: { type: "arrowclosed" }, markerEnd: { type: "arrowclosed" },
      className: "sa-edge sa-group-bus sa-kind-can",
    });
    expect(bc).not.toHaveProperty("markerEnd");
    expect(bc!.data.direction).toBe("none");
  });
});
