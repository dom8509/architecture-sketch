import { describe, expect, it } from "vitest";
import { compile, format, projectView } from "../src/index.js";
import { arch } from "./helpers.js";

const model = (source: string) => {
  const result = compile(source);
  const problems = result.diagnostics.filter((d) => d.severity !== "info");
  expect(problems, JSON.stringify(problems, null, 1)).toEqual([]);
  return result.value;
};

const SOURCE = arch([
  " view overview { label \"Overview\" }",
  " view detailed",
  " zone z {",
  "  system ecu {",
  "   component mcu: microcontroller {",
  "    pin digital CAN_TX { show in detailed }",
  "    pin power VDD",
  "   }",
  "   component trx: can_transceiver { show in detailed }",
  "  }",
  " }",
  " zone out { component motor: motor }",
  " mcu.CAN_TX -> trx.TXD",
  " mcu -> motor { label \"Window\" show in overview }",
].join("\n"));

describe("views in the model", () => {
  it("keeps declaration order and labels", () => {
    expect(model(SOURCE).views).toMatchObject([
      { id: "overview", label: "Overview" },
      { id: "detailed", label: "detailed" },
    ]);
  });

  it("is empty without `view`", () => {
    expect(model(arch(" component a")).views).toEqual([]);
  });

  it("stores `show in` on components, pins and connections", () => {
    const m = model(SOURCE);
    expect(m.components.get("trx")!.views).toEqual(["detailed"]);
    expect(m.components.get("mcu")!.views).toBeUndefined();
    expect(m.components.get("mcu")!.pins.find((p) => p.name === "CAN_TX")!.views).toEqual(["detailed"]);
    expect(m.connections.find((c) => c.label === "Window")!.views).toEqual(["overview"]);
  });
});

describe("projectView", () => {
  it("keeps only what the view shows", () => {
    const overview = projectView(model(SOURCE), "overview");
    expect([...overview.components.keys()]).toEqual(["mcu", "motor"]);
    expect(overview.components.get("mcu")!.pins.map((p) => p.name)).toEqual(["VDD"]);
    expect(overview.connections.map((c) => c.label)).toEqual(["Window"]);
  });

  it("shows everything a view does not restrict", () => {
    const detailed = projectView(model(SOURCE), "detailed");
    expect([...detailed.components.keys()]).toEqual(["mcu", "trx", "motor"]);
    expect(detailed.components.get("mcu")!.pins.map((p) => p.name)).toEqual(["CAN_TX", "VDD"]);
    expect(detailed.connections.map((c) => c.id)).toEqual(["mcu.CAN_TX->trx.TXD#1"]);
  });

  it("drops groups without visible content", () => {
    const source = arch(" view a\n view b\n zone z1 { component x { show in a } }\n zone z2 { component y { show in b } }");
    expect([...projectView(model(source), "a").groups.keys()]).toEqual(["z1"]);
    expect(projectView(model(source), "a").root.children).toEqual(["z1"]);
  });

  it("docks a connection on the body when the pin is hidden", () => {
    const source = arch(" view a\n view b\n component p: power_supply { pin power VOUT { show in b } }\n component c\n p.VOUT -> c");
    const connection = projectView(model(source), "a").connections[0]!;
    expect(connection.source).toEqual({ component: "p" });
    expect(projectView(model(source), "b").connections[0]!.source).toEqual({ component: "p", pin: "VOUT" });
  });

  it("compacts the grid to the visible components", () => {
    const source = arch(" view a\n view b\n component x { show in a }\n component y\n layout { grid {\n x | y\n } }");
    expect(projectView(model(source), "b").grid!.rows).toEqual([["y"]]);
    expect(projectView(model(source), "a").grid!.rows).toEqual([["x", "y"]]);
  });

  it("leaves the model alone without views or for an unknown view", () => {
    const plain = model(arch(" component a"));
    expect(projectView(plain, "overview")).toBe(plain);
    const m = model(SOURCE);
    expect(projectView(m, "nope")).toBe(m);
  });
});

describe("formatting views", () => {
  it("writes views before the layout and keeps `show in` on one line", () => {
    const source = arch(" component a { show in v }\n view v { label \"V\" }");
    expect(format(source).value).toBe([
      'architecture "Test" {',
      "    view v { label \"V\" }",
      "",
      "    component a { show in v }",
      "}",
      "",
    ].join("\n"));
  });

  it("is idempotent for pins with `show in`", () => {
    const once = format(SOURCE).value;
    expect(format(once).value).toBe(once);
    expect(once).toContain("pin digital CAN_TX { show in detailed }");
  });
});
