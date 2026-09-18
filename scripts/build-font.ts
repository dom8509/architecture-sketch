// Builds the embedded font data for @sysarch/themes from Inter (OFL):
//   packages/themes/src/fonts/inter-metrics.ts   advance widths + kerning pairs
//   packages/themes/src/fonts/inter-glyphs.ts    TrueType contours for the SVG subset
//
// The output is checked in; the script only runs when the font or the character set
// changes: `npm run build:font`. The source is downloaded with a pinned checksum.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import opentype from "opentype.js";

const VERSION = "4.1";
const URL = `https://github.com/rsms/inter/releases/download/v${VERSION}/Inter-${VERSION}.zip`;
const SHA256 = "9883fdd4a49d4fb66bd8177ba6625ef9a64aa45899767dde3d36aa425756b11e";
const FACES = [
  { weight: 400, file: "Inter-Regular.ttf" },
  { weight: 500, file: "Inter-Medium.ttf" },
  { weight: 600, file: "Inter-SemiBold.ttf" },
] as const;

/** Basic Latin, Latin-1 and the typographic characters that appear in labels. */
const CHARS = [
  ...range(0x20, 0x7e),
  ...range(0xa0, 0xff),
  ..."–—‘’‚“”„…•€→←↔↑↓≤≥≈≠±×÷µΩΔ°·√∞∑",
].filter((c, i, all) => all.indexOf(c) === i);

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cache = join(root, "node_modules", ".cache", "sysarch-font");
const outDir = join(root, "packages", "themes", "src", "fonts");

function range(from: number, to: number): string[] {
  return Array.from({ length: to - from + 1 }, (_, i) => String.fromCodePoint(from + i));
}

function download(): string {
  const zip = join(cache, `Inter-${VERSION}.zip`);
  if (!existsSync(zip)) {
    mkdirSync(cache, { recursive: true });
    execFileSync("curl", ["-sSL", "-o", zip, URL], { stdio: "inherit" });
  }
  const hash = createHash("sha256").update(readFileSync(zip)).digest("hex");
  if (hash !== SHA256) throw new Error(`Checksum of ${zip} does not match: ${hash}`);
  return zip;
}

function extract(zip: string, file: string): Buffer {
  return execFileSync("unzip", ["-p", zip, `extras/ttf/${file}`], { maxBuffer: 16 * 1024 * 1024 });
}

// ── GPOS-Kerning (Lookup-Typ 2, auch hinter Extension-Lookups) ──────────

function kerningPairs(data: Buffer, glyphIds: Map<number, string[]>): Map<string, number> {
  const tables = new Map<string, number>();
  const numTables = data.readUInt16BE(4);
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + 16 * i;
    tables.set(data.toString("latin1", rec, rec + 4), data.readUInt32BE(rec + 8));
  }
  const gpos = tables.get("GPOS");
  const pairs = new Map<string, number>();
  if (gpos === undefined) return pairs;

  const u16 = (o: number) => data.readUInt16BE(o);
  const i16 = (o: number) => data.readInt16BE(o);
  const scriptList = gpos + u16(gpos + 4);
  const featureList = gpos + u16(gpos + 6);
  const lookupList = gpos + u16(gpos + 8);

  // Lookups of the `kern` feature for latn or DFLT (default LangSys).
  const lookupIndexes = new Set<number>();
  const featureIndexes = new Set<number>();
  for (let i = 0; i < u16(scriptList); i++) {
    const tag = data.toString("latin1", scriptList + 2 + 6 * i, scriptList + 6 + 6 * i);
    if (tag !== "latn" && tag !== "DFLT") continue;
    const script = scriptList + u16(scriptList + 6 + 6 * i);
    const langSysOffset = u16(script);
    if (langSysOffset === 0) continue;
    const langSys = script + langSysOffset;
    for (let k = 0; k < u16(langSys + 4); k++) featureIndexes.add(u16(langSys + 6 + 2 * k));
  }
  for (const index of [...featureIndexes].sort((a, b) => a - b)) {
    const tag = data.toString("latin1", featureList + 2 + 6 * index, featureList + 6 + 6 * index);
    if (tag !== "kern") continue;
    const feature = featureList + u16(featureList + 6 + 6 * index);
    for (let k = 0; k < u16(feature + 2); k++) lookupIndexes.add(u16(feature + 4 + 2 * k));
  }

  const coverage = (offset: number): Map<number, number> => {
    const result = new Map<number, number>();
    const format = u16(offset);
    if (format === 1) {
      for (let i = 0; i < u16(offset + 2); i++) result.set(u16(offset + 4 + 2 * i), i);
    } else {
      for (let i = 0; i < u16(offset + 2); i++) {
        const r = offset + 4 + 6 * i;
        for (let g = u16(r); g <= u16(r + 2); g++) result.set(g, u16(r + 4) + g - u16(r));
      }
    }
    return result;
  };
  const classDef = (offset: number): Map<number, number> => {
    const result = new Map<number, number>();
    if (u16(offset) === 1) {
      const start = u16(offset + 2);
      for (let i = 0; i < u16(offset + 4); i++) result.set(start + i, u16(offset + 6 + 2 * i));
    } else {
      for (let i = 0; i < u16(offset + 2); i++) {
        const r = offset + 4 + 6 * i;
        for (let g = u16(r); g <= u16(r + 2); g++) result.set(g, u16(r + 4));
      }
    }
    return result;
  };
  const valueSize = (format: number) => {
    let bits = 0;
    for (let f = format; f; f >>= 1) bits += f & 1;
    return 2 * bits;
  };
  /** xAdvance from a ValueRecord (bit 0x0004). */
  const xAdvance = (offset: number, format: number) => {
    if (!(format & 0x4)) return 0;
    return i16(offset + valueSize(format & 0x3));
  };

  const ids = [...glyphIds.keys()].sort((a, b) => a - b);
  /** Pairs already matched by an earlier subtable of the same lookup. */
  for (const lookupIndex of [...lookupIndexes].sort((a, b) => a - b)) {
    const lookup = lookupList + u16(lookupList + 2 + 2 * lookupIndex);
    const type = u16(lookup);
    const applied = new Set<string>();
    for (let s = 0; s < u16(lookup + 4); s++) {
      let subtable = lookup + u16(lookup + 6 + 2 * s);
      let subtableType = type;
      if (type === 9) {
        subtableType = u16(subtable + 2);
        subtable = subtable + data.readUInt32BE(subtable + 4);
      }
      if (subtableType !== 2) continue;
      const format = u16(subtable);
      const covered = coverage(subtable + u16(subtable + 2));
      const vf1 = u16(subtable + 4);
      const vf2 = u16(subtable + 6);
      for (const first of ids) {
        const coverageIndex = covered.get(first);
        if (coverageIndex === undefined) continue;
        for (const second of ids) {
          const key = `${first},${second}`;
          if (applied.has(key)) continue;
          let value: number | undefined;
          if (format === 1) {
            const pairSet = subtable + u16(subtable + 10 + 2 * coverageIndex);
            const recordSize = 2 + valueSize(vf1) + valueSize(vf2);
            for (let p = 0; p < u16(pairSet); p++) {
              const record = pairSet + 2 + recordSize * p;
              if (u16(record) === second) {
                value = xAdvance(record + 2, vf1);
                break;
              }
            }
          } else {
            const class1 = classDef(subtable + u16(subtable + 8)).get(first) ?? 0;
            const class2 = classDef(subtable + u16(subtable + 10)).get(second) ?? 0;
            const class2Count = u16(subtable + 14);
            const recordSize = valueSize(vf1) + valueSize(vf2);
            value = xAdvance(subtable + 16 + (class1 * class2Count + class2) * recordSize, vf1);
          }
          if (value === undefined) continue;
          applied.add(key);
          if (value === 0) continue;
          for (const a of glyphIds.get(first)!) {
            for (const b of glyphIds.get(second)!) {
              pairs.set(a + b, (pairs.get(a + b) ?? 0) + value);
            }
          }
        }
      }
    }
  }
  return pairs;
}

// ── output ─────────────────────────────────────────────────────────────

interface OpenTypePoint { x: number; y: number; onCurve: boolean; lastPointOfContour: boolean }

/** Contours, compactly: contours separated by "|", points as "x y", off-curve points with "~". */
function encodeGlyph(points: OpenTypePoint[] | undefined): string {
  if (!points || points.length === 0) return "";
  const contours: string[] = [];
  let current: string[] = [];
  for (const p of points) {
    current.push(`${p.onCurve ? "" : "~"}${Math.round(p.x)} ${Math.round(p.y)}`);
    if (p.lastPointOfContour) {
      contours.push(current.join(" "));
      current = [];
    }
  }
  if (current.length) contours.push(current.join(" "));
  return contours.join("|");
}

const zip = download();
const license = execFileSync("unzip", ["-p", zip, "LICENSE.txt"]).toString("utf8");

const metricFaces: string[] = [];
const glyphFaces: string[] = [];
let header = "";

for (const face of FACES) {
  const data = extract(zip, face.file);
  const font = opentype.parse(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
  const os2 = font.tables.os2!;
  header ||= `  unitsPerEm: ${font.unitsPerEm},\n  ascender: ${os2.sTypoAscender},\n  descender: ${os2.sTypoDescender},\n  capHeight: ${os2.sCapHeight},\n  xHeight: ${os2.sxHeight},\n`;

  const advances: Record<string, number> = {};
  const glyphs: Record<string, string> = {};
  const glyphIds = new Map<number, string[]>();
  for (const char of CHARS) {
    const glyph = font.charToGlyph(char);
    if (glyph.index === 0) continue;
    advances[char] = glyph.advanceWidth ?? 0;
    glyph.getPath();
    glyphs[char] = encodeGlyph((glyph as unknown as { points?: OpenTypePoint[] }).points);
    glyphIds.set(glyph.index, [...(glyphIds.get(glyph.index) ?? []), char]);
  }
  const kerning = Object.fromEntries([...kerningPairs(data, glyphIds)].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));

  metricFaces.push(
    `    {\n      weight: ${face.weight},\n      advances: ${JSON.stringify(advances)},\n      kerning: ${JSON.stringify(kerning)},\n    }`,
  );
  glyphFaces.push(`    {\n      weight: ${face.weight},\n      glyphs: ${JSON.stringify(glyphs)},\n    }`);
  console.log(`${face.file}: ${Object.keys(advances).length} characters, ${Object.keys(kerning).length} kerning pairs`);
}

const banner =
  `// Generated by scripts/build-font.ts from Inter ${VERSION} — do not edit by hand.\n` +
  `// Inter: Copyright (c) 2016 The Inter Project Authors, SIL Open Font License 1.1 (see LICENSE-Inter.txt).\n`;

mkdirSync(outDir, { recursive: true });
writeFileSync(
  join(outDir, "inter-metrics.ts"),
  `${banner}import type { FontMetrics } from "../metrics.js";\n\nexport const INTER_METRICS: FontMetrics = {\n  family: "Inter",\n${header}  faces: [\n${metricFaces.join(",\n")},\n  ],\n};\n`,
);
writeFileSync(
  join(outDir, "inter-glyphs.ts"),
  `${banner}import type { FontGlyphs } from "../metrics.js";\n\nexport const INTER_GLYPHS: FontGlyphs = {\n  family: "Inter",\n${header}  faces: [\n${glyphFaces.join(",\n")},\n  ],\n};\n`,
);
writeFileSync(join(outDir, "LICENSE-Inter.txt"), license);
console.log(`Font data written to ${outDir.slice(root.length + 1)}`);
