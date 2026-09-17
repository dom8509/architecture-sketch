/** Schriftschnitte, für die Metriken eingebettet sind. */
export type FontWeight = 400 | 500 | 600 | 700;

interface FontHeader {
  family: string;
  unitsPerEm: number;
  /** Typografische Ober-/Unterlänge in Font-Einheiten (descender negativ). */
  ascender: number;
  descender: number;
  capHeight: number;
  xHeight: number;
}

/** Advance-Widths und Kerning-Paare einer Schrift, erzeugt von scripts/build-font.ts. */
export interface FontMetrics extends FontHeader {
  faces: FontFaceMetrics[];
}

export interface FontFaceMetrics {
  weight: number;
  advances: Readonly<Record<string, number>>;
  /** Schlüssel = zwei aufeinanderfolgende Zeichen. */
  kerning: Readonly<Record<string, number>>;
}

/** TrueType-Konturen je Zeichen für das Schrift-Subset im SVG-Export. */
export interface FontGlyphs extends FontHeader {
  faces: { weight: number; glyphs: Readonly<Record<string, string>> }[];
}

export interface TextBox {
  width: number;
  height: number;
}

/** Zeilenhöhe als Vielfaches der Schriftgröße. */
export const LINE_HEIGHT = 1.25;

/** Schnitt mit dem nächstgelegenen Gewicht; bei Gleichstand der schwerere. */
export function fontFace<T extends { weight: number }>(faces: readonly T[], weight: number): T {
  let best = faces[0]!;
  for (const face of faces) {
    const d = Math.abs(face.weight - weight);
    const bestD = Math.abs(best.weight - weight);
    if (d < bestD || (d === bestD && face.weight > best.weight)) best = face;
  }
  return best;
}

/** Breite einer Zeile in px. Unbekannte Zeichen zählen wie "0". */
export function measureLine(metrics: FontMetrics, text: string, size: number, weight: number): number {
  const face = fontFace(metrics.faces, weight);
  const fallback = face.advances["0"] ?? metrics.unitsPerEm / 2;
  let units = 0;
  let previous: string | undefined;
  for (const char of text) {
    units += face.advances[char] ?? fallback;
    if (previous !== undefined) units += face.kerning[previous + char] ?? 0;
    previous = char;
  }
  return (units * size) / metrics.unitsPerEm;
}

/** Größe eines mehrzeiligen Texts in px. */
export function measureText(metrics: FontMetrics, lines: readonly string[], size: number, weight: number): TextBox {
  let width = 0;
  for (const line of lines) width = Math.max(width, measureLine(metrics, line, size, weight));
  return { width, height: lines.length * size * LINE_HEIGHT };
}

/** Abstand von der Zeilenoberkante zur Grundlinie in px. */
export function ascent(metrics: FontMetrics, size: number): number {
  const content = (metrics.ascender - metrics.descender) / metrics.unitsPerEm;
  const halfLeading = (LINE_HEIGHT - content) / 2;
  return (halfLeading + metrics.ascender / metrics.unitsPerEm) * size;
}

/**
 * Bricht einen Text an `\n` und an Wortgrenzen um, sodass keine Zeile breiter als
 * `maxWidth` ist — außer ein einzelnes Wort ist selbst breiter (kein Abschneiden).
 */
export function wrapText(metrics: FontMetrics, text: string, size: number, weight: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(" ").filter((w) => w !== "")) {
      const candidate = line === "" ? word : `${line} ${word}`;
      if (line !== "" && measureLine(metrics, candidate, size, weight) > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    lines.push(line);
  }
  return lines;
}
