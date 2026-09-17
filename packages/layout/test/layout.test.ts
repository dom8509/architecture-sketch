import { getTheme } from "@sysarch/themes";
import { describe, expect, it } from "vitest";
import type { SceneGraph, SceneShape } from "../src/index.js";
import { examples, render } from "./helpers.js";

const body = (scene: SceneGraph, id: string) =>
  scene.items.find((i): i is SceneShape => i.type === "shape" && i.ref === `component:${id}`)!;
const path = (scene: SceneGraph, id: string) => {
  const item = scene.items.find((i) => i.type === "path" && i.ref === `connection:${id}`);
  if (item?.type !== "path") throw new Error(`Verbindung ${id} fehlt`);
  return item.points;
};

describe("Ränge und Flussrichtung", () => {
  it("ordnet Quelle vor Ziel an (LR: links → rechts)", () => {
    const scene = render(`architecture "T" { component a  component b  component c  a -> b  b -> c }`);
    expect(body(scene, "a").x).toBeLessThan(body(scene, "b").x);
    expect(body(scene, "b").x).toBeLessThan(body(scene, "c").x);
  });

  it("ordnet bei TB von oben nach unten an", () => {
    const scene = render(`architecture "T" { direction TB  component a  component b  a -> b }`);
    expect(body(scene, "a").y).toBeLessThan(body(scene, "b").y);
    expect(body(scene, "a").x).toBe(body(scene, "b").x);
  });

  it("führt eine gerade Verbindung ohne Knick, wenn die Pins ausgerichtet werden können", () => {
    const scene = render(`architecture "T" { component a  component b  a -> b }`);
    expect(path(scene, "a->b#1")).toHaveLength(2);
  });

  it("bricht Zyklen und führt die Rückführung unterhalb (LR)", () => {
    const scene = render(`architecture "T" { component a  component b  a -> b  b -> a }`);
    expect(body(scene, "a").x).toBeLessThan(body(scene, "b").x);
    const back = path(scene, "b->a#1");
    const bottom = Math.max(body(scene, "a").y + body(scene, "a").height, body(scene, "b").y + body(scene, "b").height);
    expect(Math.max(...back.map((p) => p.y))).toBeGreaterThan(bottom);
  });

  it("reiht Zonen in Deklarationsreihenfolge, auch gegen die Kantenrichtung", () => {
    const scene = render(`architecture "T" {
      zone first { component a }
      zone second { component b }
      b -> a
    }`);
    expect(body(scene, "a").x).toBeLessThan(body(scene, "b").x);
    const zones = scene.items.filter((i) => i.type === "rect" && i.className === "sa-zone");
    expect(zones.map((z) => z.ref)).toEqual(["zone:first", "zone:second"]);
  });

  it("hält Systemmitglieder im Rahmen zusammen", () => {
    const scene = render(`architecture "T" {
      component x
      system s { label "S" component a  component b }
      component y
      x -> a  x -> y  x -> b
    }`);
    const frame = scene.items.find((i) => i.type === "rect" && i.ref === "system:s");
    if (frame?.type !== "rect") throw new Error("Rahmen fehlt");
    for (const id of ["a", "b"]) {
      const s = body(scene, id);
      expect(s.y).toBeGreaterThan(frame.y);
      expect(s.y + s.height).toBeLessThan(frame.y + frame.height);
    }
    const y = body(scene, "y");
    const outside = y.y >= frame.y + frame.height || y.y + y.height <= frame.y;
    expect(outside).toBe(true);
  });
});

describe("Overrides", () => {
  it("setzt Spalten und Zeilen aus dem Grid", () => {
    const scene = render(`architecture "T" {
      layout { grid {
        b | a
        c | .
      } }
      component a  component b  component c
    }`);
    expect(body(scene, "b").x).toBeLessThan(body(scene, "a").x);
    expect(body(scene, "b").x).toBe(body(scene, "c").x);
    expect(body(scene, "b").y).toBeLessThan(body(scene, "c").y);
  });

  it("streckt eine Komponente über mehrere Spalten; Nachbarn darüber und darunter docken gerade an", () => {
    const scene = render(`architecture "T" {
      layout { grid {
        .   | a   | b   | .
        sbc | mcu | mcu | co
        .   | c   | d   | .
      } }
      component sbc  component mcu  component co
      component a  component b  component c  component d
      sbc -> mcu  mcu -> co
      mcu -> a  mcu -> b  c -> mcu  d -> mcu
    }`);
    const mcu = body(scene, "mcu");
    for (const id of ["a", "b", "c", "d"]) {
      const s = body(scene, id);
      expect(s.x, id).toBeGreaterThanOrEqual(mcu.x);
      expect(s.x + s.width, id).toBeLessThanOrEqual(mcu.x + mcu.width);
    }
    expect(body(scene, "a").y + body(scene, "a").height).toBeLessThan(mcu.y);
    expect(body(scene, "c").y).toBeGreaterThan(mcu.y + mcu.height);
    expect(body(scene, "sbc").x + body(scene, "sbc").width).toBeLessThan(mcu.x);
    expect(body(scene, "co").x).toBeGreaterThan(mcu.x + mcu.width);
    // Verbindungen nach oben und unten ohne Knick.
    for (const id of ["a", "b", "c", "d"]) {
      const path = scene.items.find((i) => i.type === "path" && i.ref?.startsWith("connection:") && i.ref.includes(id));
      expect(path?.type === "path" && path.points.length, id).toBe(2);
    }
  });

  it("streckt eine Komponente über mehrere Zeilen", () => {
    const scene = render(`architecture "T" {
      layout { grid {
        a | mcu
        b | mcu
        c | mcu
      } }
      component a  component b  component c  component mcu
    }`);
    const mcu = body(scene, "mcu");
    expect(mcu.y).toBe(body(scene, "a").y);
    expect(mcu.y + mcu.height).toBe(body(scene, "c").y + body(scene, "c").height);
  });

  it("hält feste Zeilen gegen die Pin-Ausrichtung", () => {
    const scene = render(`architecture "T" {
      layout { grid {
        .   | top
        src | .
      } }
      component src  component top
      src -> top
    }`);
    expect(body(scene, "top").y + body(scene, "top").height).toBeLessThanOrEqual(body(scene, "src").y);
  });

  it("count stapelt Karten innerhalb der Hülle und zeigt die Anzahl", () => {
    const scene = render(`architecture "T" {
      component one: half_bridge
      component two: half_bridge { count 2 }
      component many: half_bridge { count 8 }
    }`);
    const shape = (id: string) => scene.items.find((i) => i.type === "shape" && i.ref === `component:${id}`)!;
    const one = shape("one");
    expect(one.type === "shape" && one.stack).toBeUndefined();
    // Stapeltiefe = halbe Grid-Einheit, höchstens zwei hintere Karten.
    const grid = getTheme("automotive-light").spacing.grid;
    expect(shape("two")).toMatchObject({ stack: { layers: 1, offset: grid / 2 } });
    expect(shape("many")).toMatchObject({ stack: { layers: 2, offset: grid / 4 } });
    const count = scene.items.find((i) => i.type === "text" && i.className === "sa-label sa-component-count" && i.ref === "component:many");
    expect(count?.type === "text" && count.lines).toEqual(["×8"]);
    // Pins rechts sitzen weiter auf der Hülle (mit Stummel über die hinteren Karten).
    const out = scene.items.find((i) => i.type === "marker" && i.ref === "pin:many.OUT");
    expect(out?.type === "marker" && out.x).toBe(body(scene, "many").x + body(scene, "many").width);
  });

  it("stack identical zeichnet gleich verschaltete Komponenten als einen Stapel", () => {
    const scene = render(`architecture "T" {
      stack identical
      component mcu: microcontroller
      component l1: load { label "Lamp 1" }
      component l2: load { label "Lamp 2" }
      component l3: load { label "Lamp 3" }
      mcu -> l1
      mcu -> l2
      mcu -> l3
    }`);
    const shapes = scene.items.filter((i) => i.type === "shape").map((i) => i.ref);
    expect(shapes).toEqual(["component:mcu", "component:l1"]);
    expect(scene.items.filter((i) => i.type === "path" && i.ref?.startsWith("connection:"))).toHaveLength(1);
    const count = scene.items.find((i) => i.type === "text" && i.className === "sa-label sa-component-count");
    expect(count?.type === "text" && count.lines).toEqual(["×3"]);
  });

  it("pins connected zeichnet nur verbundene Pins, pins none keine", () => {
    const source = (mode: string) => `architecture "T" {
      pins ${mode}
      component psu: power_supply
      component mcu: microcontroller { pin power VDD  pin can CAN_TX }
      psu.VOUT -> mcu.VDD
    }`;
    const pinRefs = (scene: SceneGraph) =>
      scene.items.filter((i) => i.type === "marker" && i.shape === "pin").map((i) => i.ref).sort();
    expect(pinRefs(render(source("all")))).toHaveLength(6);
    expect(pinRefs(render(source("connected")))).toEqual(["pin:mcu.VDD", "pin:psu.VOUT"]);
    const none = render(source("none"));
    expect(pinRefs(none)).toEqual([]);
    expect(none.items.some((i) => i.type === "text" && i.className === "sa-label sa-pin-label")).toBe(false);
    // Die Verbindung bleibt, jetzt als Körperanschluss.
    expect(none.items.filter((i) => i.type === "path" && i.ref?.startsWith("connection:"))).toHaveLength(1);
    expect(body(none, "psu").height).toBeLessThan(body(render(source("all")), "psu").height);
  });

  it("wendet hint column in mode assisted an", () => {
    const scene = render(`architecture "T" {
      layout { mode assisted }
      component a { hint column 3 }
      component b
      b -> a
    }`);
    expect(body(scene, "a").x).toBeGreaterThan(body(scene, "b").x);
  });
});

describe("Szene", () => {
  it("zeichnet in der Reihenfolge Zonen → Systeme → Verbindungen → Komponenten → Icons → Pins → Labels", () => {
    const scene = render(`architecture "T" {
      zone z { label "Z" system s { label "S" component mcu: microcontroller { pin can TX } component trx: can_transceiver } }
      mcu.TX -> trx.TXD { label "TX"  type can }
    }`);
    const rank = (i: SceneGraph["items"][number]) =>
      i.className === "sa-zone" ? 0 : i.className === "sa-system" ? 1
        : i.className?.startsWith("sa-connection") || i.className?.startsWith("sa-marker") ? 2
          : i.type === "shape" || i.className === "sa-stub" ? 3 : i.type === "icon" ? 4 : i.className?.startsWith("sa-pin") ? 5 : 6;
    const ranks = scene.items.map(rank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(scene.icons.map((i) => i.name)).toEqual(["can", "chip"]);
  });

  it("markiert Masseverbindungen mit dem Masse-Symbol und bidirektionale mit zwei Pfeilen", () => {
    const scene = render(`architecture "T" {
      component a { pin ground G  pin can C }
      component b { pin ground G  pin can C }
      a.G -> b.G
      a.C <-> b.C
    }`);
    const markers = scene.items.filter((i) => i.type === "marker" && i.className?.startsWith("sa-marker"));
    expect(markers.filter((m) => m.ref === "connection:a.G->b.G#1").map((m) => m.type === "marker" && m.shape)).toEqual(["ground"]);
    expect(markers.filter((m) => m.ref === "connection:a.C->b.C#1")).toHaveLength(2);
  });

  it("setzt Pfeilspitzen vor den Pin-Marker, damit sie nicht verdeckt werden", () => {
    const scene = render(`architecture "T" { component a { pin digital O } component b { pin digital I } a.O -> b.I }`);
    const arrow = scene.items.find((i) => i.type === "marker" && i.shape === "arrow");
    const pin = scene.items.find((i) => i.type === "marker" && i.ref === "pin:b.I");
    if (arrow?.type !== "marker" || pin?.type !== "marker") throw new Error("Marker fehlen");
    expect(arrow.angle).toBe(0);
    expect(arrow.x).toBeLessThanOrEqual(pin.x - pin.size / 2);
    expect(arrow.y).toBe(pin.y);
  });

  it("überspringt kreuzende Leitungen mit einer Brücke auf dem waagerechten Segment", () => {
    // Im Body Control Module kreuzen sich u. a. die CAN-Leitungen der MCU.
    const scene = render(examples().find((e) => e.name === "body-control-module")!.source);
    const paths = scene.items.filter((i) => i.type === "path" && i.className?.startsWith("sa-connection"));
    const hops = paths.flatMap((p) => (p.type === "path" ? p.hops ?? [] : []));
    expect(hops.length).toBeGreaterThan(0);
    for (const p of paths) {
      if (p.type !== "path" || !p.hops) continue;
      for (const h of p.hops) {
        const onHorizontal = p.points.slice(1).some((b, i) => {
          const a = p.points[i]!;
          return a.y === b.y && a.y === h.y && Math.min(a.x, b.x) < h.x && h.x < Math.max(a.x, b.x);
        });
        expect(onHorizontal).toBe(true);
      }
    }
  });
});
