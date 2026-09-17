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
