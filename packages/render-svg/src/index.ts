import type { ArchitectureModel, IconDef } from "@sysarch/core";
import { layout, stackFront } from "@sysarch/layout";
import type {
  Point, SceneGraph, SceneIcon, SceneItem, SceneMarker, ScenePath, SceneRect, SceneShape, SceneText,
} from "@sysarch/layout";
import { getTheme, INTER_GLYPHS, INTER_METRICS, type FontGlyphs, type FontMetrics } from "@sysarch/themes";
import { base64, buildFontSubset } from "./font.js";

export { buildFontSubset } from "./font.js";

export interface RenderOptions {
  /** Schrift-Subset per `@font-face` einbetten (Standard: ja). */
  embedFont?: boolean;
  glyphs?: FontGlyphs;
  metrics?: FontMetrics;
}

const FALLBACK_FONTS = "'Helvetica Neue', Arial, sans-serif";

/**
 * Semantic Model → SceneGraph; `theme` überschreibt das Theme der Quelle. Gemeinsamer Schritt
 * aller Exporte (SVG, PNG, React Flow), damit sie dieselbe Geometrie zeigen.
 */
export function architectureScene(model: ArchitectureModel, theme?: string): SceneGraph {
  return layout(model, getTheme(theme ?? model.theme));
}

/**
 * Semantic Model → SVG über Layout und Renderer. Einziger Weg von CLI und Editor zum SVG —
 * deshalb sind beide Ausgaben byte-gleich.
 */
export function renderArchitecture(model: ArchitectureModel, theme?: string): string {
  return renderSvg(architectureScene(model, theme));
}

/** SceneGraph → eigenständiges SVG 1.1. Deterministisch: feste Attributreihenfolge, zwei Nachkommastellen. */
export function renderSvg(scene: SceneGraph, options: RenderOptions = {}): string {
  const out: string[] = [];
  const w = num(scene.width);
  const h = num(scene.height);
  const hasTitle = scene.title !== "";
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img"` +
      `${hasTitle ? ` aria-labelledby="sa-title"` : ""} class="sa-diagram">`,
  );
  if (hasTitle) out.push(`<title id="sa-title">${escape(scene.title)}</title>`);

  const defs: string[] = [];
  if (options.embedFont ?? true) {
    const css = fontFaces(scene, options.glyphs ?? INTER_GLYPHS, options.metrics ?? INTER_METRICS);
    if (css) defs.push(`<style>${css}</style>`);
  }
  for (const icon of scene.icons) defs.push(symbol(icon));
  if (defs.length) out.push(`<defs>`, ...defs, `</defs>`);

  out.push(`<rect class="sa-background" width="${w}" height="${h}" fill="${scene.background}"/>`);
  for (const item of scene.items) out.push(renderItem(item));
  out.push(`</svg>`);
  return out.join("\n") + "\n";
}

function renderItem(item: SceneItem): string {
  switch (item.type) {
    case "rect": return rect(item);
    case "shape": return shape(item);
    case "path": return path(item);
    case "marker": return marker(item);
    case "icon": return icon(item);
    case "text": return text(item);
  }
}

// ── Elemente ───────────────────────────────────────────────────

function common(item: SceneItem): string {
  return `${item.className ? ` class="${item.className}"` : ""}${item.ref ? ` data-ref="${escape(item.ref)}"` : ""}`;
}

function dash(values: number[] | undefined): string {
  return values ? ` stroke-dasharray="${values.map(num).join(" ")}"` : "";
}

function rect(r: SceneRect): string {
  return (
    `<rect${common(r)} x="${num(r.x)}" y="${num(r.y)}" width="${num(r.width)}" height="${num(r.height)}"` +
    `${r.radius ? ` rx="${num(r.radius)}"` : ""} fill="${r.fill}" stroke="${r.stroke}" stroke-width="${num(r.strokeWidth)}"${dash(r.dash)}/>`
  );
}

function shape(s: SceneShape): string {
  if (!s.stack) return outline(s);
  // Mehrfachelement: hintere Karten zuerst, jede nach oben rechts versetzt, vorne die kleinere Karte.
  const { layers, offset } = s.stack;
  const front = stackFront(s, layers * offset);
  const cards: string[] = [];
  for (let k = layers; k >= 0; k--) {
    cards.push(outline({ ...front, x: front.x + k * offset, y: front.y - k * offset, shape: s.shape, radius: s.radius, fill: s.fill, stroke: s.stroke, strokeWidth: s.strokeWidth, type: "shape" }));
  }
  return `<g${common(s)}>${cards.join("")}</g>`;
}

function outline(s: SceneShape): string {
  const paint = ` fill="${s.fill}" stroke="${s.stroke}" stroke-width="${num(s.strokeWidth)}"`;
  const { x, y, width, height } = s;
  switch (s.shape) {
    case "rounded":
    case "rect":
      return `<rect${common(s)} x="${num(x)}" y="${num(y)}" width="${num(width)}" height="${num(height)}"${s.radius ? ` rx="${num(s.radius)}"` : ""}${paint}/>`;
    case "circle": {
      const r = Math.min(width, height) / 2;
      const cx = x + width / 2;
      const cy = y + height / 2;
      return `<path${common(s)} d="M${num(cx - r)} ${num(cy)}A${num(r)} ${num(r)} 0 1 1 ${num(cx + r)} ${num(cy)}A${num(r)} ${num(r)} 0 1 1 ${num(cx - r)} ${num(cy)}Z"${paint}/>`;
    }
    case "hexagon": {
      const tip = height / 4;
      const cy = y + height / 2;
      const d = [
        [x, cy], [x + tip, y], [x + width - tip, y], [x + width, cy], [x + width - tip, y + height], [x + tip, y + height],
      ].map(([px, py], i) => `${i ? "L" : "M"}${num(px!)} ${num(py!)}`).join("") + "Z";
      return `<path${common(s)} d="${d}"${paint} stroke-linejoin="round"/>`;
    }
    case "cylinder": {
      const rx = width / 2;
      const ry = Math.min(s.radius, height / 4);
      const d =
        `M${num(x)} ${num(y + ry)}A${num(rx)} ${num(ry)} 0 0 1 ${num(x + width)} ${num(y + ry)}` +
        `V${num(y + height - ry)}A${num(rx)} ${num(ry)} 0 0 1 ${num(x)} ${num(y + height - ry)}Z` +
        `M${num(x)} ${num(y + ry)}A${num(rx)} ${num(ry)} 0 0 0 ${num(x + width)} ${num(y + ry)}`;
      return `<path${common(s)} d="${d}"${paint}/>`;
    }
  }
}

function pathData(points: readonly Point[]): string {
  return points.map((p, i) => `${i ? "L" : "M"}${num(p.x)} ${num(p.y)}`).join("");
}

/** Pfaddaten mit Brücken: Auf waagerechten Segmenten ersetzt ein Halbkreis nach oben die Kreuzung. */
function hoppedPathData(p: ScenePath): string {
  const r = p.hopRadius ?? 0;
  if (!p.hops?.length || r <= 0) return pathData(p.points);
  let d = `M${num(p.points[0]!.x)} ${num(p.points[0]!.y)}`;
  for (let i = 1; i < p.points.length; i++) {
    const a = p.points[i - 1]!;
    const b = p.points[i]!;
    if (a.y === b.y && a.x !== b.x) {
      const dir = Math.sign(b.x - a.x);
      const on = p.hops
        .filter((h) => h.y === a.y && (h.x - a.x) * dir > 0 && (b.x - h.x) * dir > 0)
        .sort((h, k) => (h.x - k.x) * dir);
      for (const h of on) {
        d += `L${num(h.x - dir * r)} ${num(h.y)}A${num(r)} ${num(r)} 0 0 ${dir > 0 ? 1 : 0} ${num(h.x + dir * r)} ${num(h.y)}`;
      }
    }
    d += `L${num(b.x)} ${num(b.y)}`;
  }
  return d;
}

function path(p: ScenePath): string {
  const d = hoppedPathData(p);
  const line = (stroke: string, width: number, extra = "") =>
    `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${num(width)}" stroke-linejoin="miter"${extra}/>`;
  if (p.double) {
    return `<g${common(p)}>${line(p.stroke, p.strokeWidth)}${line(p.gap ?? "#FFFFFF", p.strokeWidth / 3)}</g>`;
  }
  return `<path${common(p)} d="${d}" fill="none" stroke="${p.stroke}" stroke-width="${num(p.strokeWidth)}"${dash(p.dash)}/>`;
}

/** Punkt in Markerkoordinaten (u entlang der Richtung, v quer dazu) → absolut. */
function rotate(m: SceneMarker, u: number, v: number): Point {
  switch (m.angle) {
    case 0: return { x: m.x + u, y: m.y + v };
    case 90: return { x: m.x - v, y: m.y + u };
    case 180: return { x: m.x - u, y: m.y - v };
    case 270: return { x: m.x + v, y: m.y - u };
  }
}

function marker(m: SceneMarker): string {
  const s = m.size;
  switch (m.shape) {
    case "arrow": {
      const pts = [rotate(m, 0, 0), rotate(m, -s, -s / 2), rotate(m, -s, s / 2)];
      return `<path${common(m)} d="${pathData(pts)}Z" fill="${m.fill}" stroke="${m.stroke}" stroke-width="${num(m.strokeWidth)}" stroke-linejoin="miter"/>`;
    }
    case "ground": {
      const bars = [[0, s / 2], [-s / 4, s / 3], [-s / 2, s / 6]] as const;
      const d = bars.map(([u, half]) => pathData([rotate(m, u, -half), rotate(m, u, half)])).join("");
      return `<path${common(m)} d="${d}" fill="none" stroke="${m.stroke}" stroke-width="${num(Math.max(m.strokeWidth, 1.5))}"/>`;
    }
    case "pin":
      return `<rect${common(m)} x="${num(m.x - s / 2)}" y="${num(m.y - s / 2)}" width="${num(s)}" height="${num(s)}" fill="${m.fill}" stroke="${m.stroke}" stroke-width="${num(m.strokeWidth)}"/>`;
    case "junction":
      return `<circle${common(m)} cx="${num(m.x)}" cy="${num(m.y)}" r="${num(s / 2)}" fill="${m.fill}" stroke="${m.stroke}" stroke-width="${num(m.strokeWidth)}"/>`;
  }
}

function icon(i: SceneIcon): string {
  return (
    `<use${common(i)} href="#sa-icon-${i.name}" x="${num(i.x)}" y="${num(i.y)}" width="${num(i.size)}" height="${num(i.size)}"` +
    ` color="${i.color}" stroke-width="${num(i.strokeWidth)}"/>`
  );
}

function symbol(def: IconDef): string {
  const paths = def.elements.map((e) =>
    e.mode === "fill"
      ? `<path d="${e.d}" fill="currentColor" stroke="none"/>`
      : `<path d="${e.d}" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>`,
  );
  return `<symbol id="sa-icon-${def.name}" viewBox="${def.viewBox}">${paths.join("")}</symbol>`;
}

function text(t: SceneText): string {
  const total = t.lines.length * t.lineHeight;
  const top = t.baseline === "top" ? t.y : t.baseline === "middle" ? t.y - total / 2 : t.y - total;
  const family = `${t.style.fontFamily}, ${FALLBACK_FONTS}`;
  const spans = t.lines.map(
    (line, i) => `<tspan x="${num(t.x)}" y="${num(top + t.ascent + i * t.lineHeight)}">${escape(line)}</tspan>`,
  );
  const x = t.anchor === "start" ? t.x : t.anchor === "middle" ? t.x - t.width / 2 : t.x - t.width;
  const halo = t.halo
    ? `<rect class="sa-halo" x="${num(x - 2)}" y="${num(top)}" width="${num(t.width + 4)}" height="${num(total)}" fill="${t.halo}"/>`
    : "";
  return (
    `${halo}<text${common(t)} text-anchor="${t.anchor}" font-family="${family}" font-size="${num(t.style.size)}"` +
    ` font-weight="${t.style.weight}" fill="${t.style.color}">${spans.join("")}</text>`
  );
}

// ── Schrift ────────────────────────────────────────────────────

export interface FontSubset {
  family: string;
  weight: number;
  /** TrueType-Datei mit genau den Zeichen, die die Szene in diesem Schnitt verwendet. */
  data: Uint8Array;
}

/**
 * Schrift-Subsets je verwendetem Schnitt, nach Gewicht sortiert — dieselben Dateien, die das
 * SVG per `@font-face` einbettet. Rasterisierer ohne `@font-face`-Unterstützung (resvg) laden sie direkt.
 */
export function fontSubsets(scene: SceneGraph, glyphs: FontGlyphs = INTER_GLYPHS, metrics: FontMetrics = INTER_METRICS): FontSubset[] {
  const byWeight = new Map<number, Set<string>>();
  for (const item of scene.items) {
    if (item.type !== "text" || item.style.fontFamily !== glyphs.family) continue;
    const chars = byWeight.get(item.style.weight) ?? new Set<string>();
    for (const line of item.lines) for (const c of line) chars.add(c);
    byWeight.set(item.style.weight, chars);
  }
  return [...byWeight.keys()]
    .sort((a, b) => a - b)
    .map((weight) => ({ family: glyphs.family, weight, data: buildFontSubset(glyphs, metrics, weight, byWeight.get(weight)!) }));
}

function fontFaces(scene: SceneGraph, glyphs: FontGlyphs, metrics: FontMetrics): string {
  return fontSubsets(scene, glyphs, metrics)
    .map(({ family, weight, data }) =>
      `@font-face{font-family:"${family}";font-weight:${weight};src:url(data:font/ttf;base64,${base64(data)}) format("truetype")}`)
    .join("");
}

// ── Formatierung ───────────────────────────────────────────────

export function num(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

function escape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
