import { fontFace, type FontGlyphs, type FontMetrics } from "@sysarch/themes";

/**
 * Baut aus eingebetteten Konturen eine minimale TrueType-Datei mit genau den verwendeten
 * Zeichen (plus Kerning-Paare als `kern`-Tabelle). Deterministisch: feste Zeitstempel,
 * feste Tabellenreihenfolge.
 */
export function buildFontSubset(
  glyphs: FontGlyphs,
  metrics: FontMetrics,
  weight: number,
  text: Iterable<string>,
): Uint8Array {
  const face = fontFace(glyphs.faces, weight);
  const metricFace = fontFace(metrics.faces, weight);

  const chars = [...new Set(text)]
    .filter((c) => face.glyphs[c] !== undefined && c.codePointAt(0)! <= 0xffff)
    .sort((a, b) => a.codePointAt(0)! - b.codePointAt(0)!);

  // ── Glyphen ──────────────────────────────────────────────────
  interface Glyph { data: Uint8Array; advance: number; xMin: number; yMin: number; xMax: number; yMax: number; points: number; contours: number }
  const empty = (advance: number): Glyph => ({ data: new Uint8Array(0), advance, xMin: 0, yMin: 0, xMax: 0, yMax: 0, points: 0, contours: 0 });
  const list: Glyph[] = [empty(Math.round(glyphs.unitsPerEm / 2))];
  for (const c of chars) list.push(encodeGlyph(face.glyphs[c]!, metricFace.advances[c] ?? 0));

  const glyf = byteWriter();
  const loca: number[] = [];
  for (const g of list) {
    loca.push(glyf.length);
    glyf.bytes(g.data);
    glyf.pad(4);
  }
  loca.push(glyf.length);

  const bbox = list.filter((g) => g.contours > 0);
  const xMin = Math.min(0, ...bbox.map((g) => g.xMin));
  const yMin = Math.min(0, ...bbox.map((g) => g.yMin));
  const xMax = Math.max(0, ...bbox.map((g) => g.xMax));
  const yMax = Math.max(0, ...bbox.map((g) => g.yMax));
  const numGlyphs = list.length;

  const head = byteWriter();
  head.u32(0x00010000).u32(0x00010000).u32(0).u32(0x5f0f3cf5).u16(0x000b).u16(glyphs.unitsPerEm);
  head.u32(0).u32(0).u32(0).u32(0); // created, modified: fest 0
  head.i16(xMin).i16(yMin).i16(xMax).i16(yMax).u16(0).u16(8).i16(2).i16(1).i16(0);

  const advanceMax = Math.max(...list.map((g) => g.advance));
  const hhea = byteWriter();
  hhea.u32(0x00010000).i16(glyphs.ascender).i16(glyphs.descender).i16(0).u16(advanceMax);
  hhea.i16(Math.min(...list.map((g) => g.xMin)));
  hhea.i16(Math.min(...list.map((g) => g.advance - g.xMax)));
  hhea.i16(Math.max(...list.map((g) => g.xMax)));
  hhea.i16(1).i16(0).i16(0).i16(0).i16(0).i16(0).i16(0).i16(0).u16(numGlyphs);

  const maxp = byteWriter();
  maxp.u32(0x00010000).u16(numGlyphs);
  maxp.u16(Math.max(0, ...list.map((g) => g.points))).u16(Math.max(0, ...list.map((g) => g.contours)));
  maxp.u16(0).u16(0).u16(2).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0);

  const hmtx = byteWriter();
  for (const g of list) hmtx.u16(g.advance).i16(g.xMin);

  const codes = chars.map((c) => c.codePointAt(0)!);
  const os2 = byteWriter();
  const avg = Math.round(list.reduce((s, g) => s + g.advance, 0) / numGlyphs);
  os2.u16(4).i16(avg).u16(weight).u16(5).u16(0);
  const em = glyphs.unitsPerEm;
  for (const v of [0.65, 0.6, 0, 0.075, 0.65, 0.6, 0, 0.35]) os2.i16(Math.round(v * em));
  os2.i16(Math.round(0.05 * em)).i16(Math.round(0.26 * em)).i16(0);
  os2.bytes(new Uint8Array(10));
  os2.u32(0b11).u32(0).u32(0).u32(0);
  os2.bytes(ascii("NONE"));
  os2.u16(weight >= 600 ? 0x20 | 0x80 : 0x40 | 0x80);
  os2.u16(codes.length ? Math.min(...codes) : 0x20).u16(codes.length ? Math.max(...codes) : 0x20);
  os2.i16(glyphs.ascender).i16(glyphs.descender).i16(0);
  os2.u16(Math.max(glyphs.ascender, yMax)).u16(Math.max(-glyphs.descender, -yMin));
  os2.u32(1).u32(0);
  os2.i16(glyphs.xHeight).i16(glyphs.capHeight).u16(0).u16(0x20).u16(0);

  // cmap Format 4, ein Segment je Zeichen.
  const cmap = byteWriter();
  const segCount = codes.length + 1;
  const entrySelector = Math.floor(Math.log2(segCount));
  const searchRange = 2 * 2 ** entrySelector;
  const subtableLength = 16 + 8 * segCount;
  cmap.u16(0).u16(1).u16(3).u16(1).u32(12);
  cmap.u16(4).u16(subtableLength).u16(0).u16(segCount * 2).u16(searchRange).u16(entrySelector).u16(segCount * 2 - searchRange);
  for (const code of codes) cmap.u16(code);
  cmap.u16(0xffff).u16(0);
  for (const code of codes) cmap.u16(code);
  cmap.u16(0xffff);
  codes.forEach((code, i) => cmap.u16((i + 1 - code + 0x10000) & 0xffff));
  cmap.u16(1);
  for (let i = 0; i < segCount; i++) cmap.u16(0);

  const family = glyphs.family;
  const psName = `${family.replace(/[^A-Za-z0-9]/g, "")}-Subset${weight}`;
  const names: [number, string][] = [
    [1, family], [2, "Regular"], [3, psName], [4, `${family} Subset ${weight}`], [6, psName],
  ];
  const name = byteWriter();
  const strings = byteWriter();
  name.u16(0).u16(names.length).u16(6 + 12 * names.length);
  for (const [id, value] of names) {
    const encoded = utf16be(value);
    name.u16(3).u16(1).u16(0x409).u16(id).u16(encoded.length).u16(strings.length);
    strings.bytes(encoded);
  }
  name.bytes(strings.toBytes());

  const post = byteWriter();
  post.u32(0x00030000).u32(0).i16(-150).i16(50).u32(0).u32(0).u32(0).u32(0).u32(0);

  const tables: [string, Uint8Array][] = [
    ["OS/2", os2.toBytes()],
    ["cmap", cmap.toBytes()],
    ["glyf", glyf.toBytes()],
    ["head", head.toBytes()],
    ["hhea", hhea.toBytes()],
    ["hmtx", hmtx.toBytes()],
  ];

  // Kerning-Paare zwischen verwendeten Zeichen.
  const pairs: [number, number, number][] = [];
  chars.forEach((left, li) => {
    chars.forEach((right, ri) => {
      const value = metricFace.kerning[left + right];
      if (value) pairs.push([li + 1, ri + 1, value]);
    });
  });
  if (pairs.length) {
    const kern = byteWriter();
    const n = pairs.length;
    const sel = Math.floor(Math.log2(n));
    const range = 2 ** sel * 6;
    kern.u16(0).u16(1).u16(0).u16(14 + 6 * n).u16(0x0001);
    kern.u16(n).u16(range).u16(sel).u16(n * 6 - range);
    for (const [l, r, v] of pairs) kern.u16(l).u16(r).i16(v);
    tables.push(["kern", kern.toBytes()]);
  }

  const locaWriter = byteWriter();
  for (const offset of loca) locaWriter.u32(offset);
  tables.push(["loca", locaWriter.toBytes()], ["maxp", maxp.toBytes()], ["name", name.toBytes()], ["post", post.toBytes()]);
  tables.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  // ── sfnt ─────────────────────────────────────────────────────
  const numTables = tables.length;
  const selector = Math.floor(Math.log2(numTables));
  const range = 2 ** selector * 16;
  const font = byteWriter();
  font.u32(0x00010000).u16(numTables).u16(range).u16(selector).u16(numTables * 16 - range);
  let offset = 12 + 16 * numTables;
  const headOffsetIndex: { value: number } = { value: 0 };
  for (const [tag, data] of tables) {
    if (tag === "head") headOffsetIndex.value = offset;
    font.bytes(ascii(tag)).u32(checksum(data)).u32(offset).u32(data.length);
    offset += Math.ceil(data.length / 4) * 4;
  }
  for (const [, data] of tables) {
    font.bytes(data);
    font.pad(4);
  }
  const bytes = font.toBytes();
  const adjustment = (0xb1b0afba - checksum(bytes)) >>> 0;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  view.setUint32(headOffsetIndex.value + 8, adjustment);
  return bytes;
}

function encodeGlyph(encoded: string, advance: number): {
  data: Uint8Array; advance: number; xMin: number; yMin: number; xMax: number; yMax: number; points: number; contours: number;
} {
  if (encoded === "") return { data: new Uint8Array(0), advance, xMin: 0, yMin: 0, xMax: 0, yMax: 0, points: 0, contours: 0 };
  const contours = encoded.split("|").map((contour) => {
    const tokens = contour.split(" ");
    const points: { x: number; y: number; on: boolean }[] = [];
    for (let i = 0; i < tokens.length; i += 2) {
      const rawX = tokens[i]!;
      const on = !rawX.startsWith("~");
      points.push({ x: Number(on ? rawX : rawX.slice(1)), y: Number(tokens[i + 1]), on });
    }
    return points;
  });
  const all = contours.flat();
  const xMin = Math.min(...all.map((p) => p.x));
  const yMin = Math.min(...all.map((p) => p.y));
  const xMax = Math.max(...all.map((p) => p.x));
  const yMax = Math.max(...all.map((p) => p.y));

  const w = byteWriter();
  w.i16(contours.length).i16(xMin).i16(yMin).i16(xMax).i16(yMax);
  let end = -1;
  for (const c of contours) {
    end += c.length;
    w.u16(end);
  }
  w.u16(0); // keine Instruktionen
  for (const p of all) w.u8(p.on ? 1 : 0);
  let x = 0;
  for (const p of all) {
    w.i16(p.x - x);
    x = p.x;
  }
  let y = 0;
  for (const p of all) {
    w.i16(p.y - y);
    y = p.y;
  }
  return { data: w.toBytes(), advance, xMin, yMin, xMax, yMax, points: all.length, contours: contours.length };
}

function checksum(data: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    const word = ((data[i] ?? 0) << 24) | ((data[i + 1] ?? 0) << 16) | ((data[i + 2] ?? 0) << 8) | (data[i + 3] ?? 0);
    sum = (sum + (word >>> 0)) >>> 0;
  }
  return sum;
}

function ascii(text: string): Uint8Array {
  return Uint8Array.from(text, (c) => c.charCodeAt(0));
}

function utf16be(text: string): Uint8Array {
  const out = new Uint8Array(text.length * 2);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    out[2 * i] = code >> 8;
    out[2 * i + 1] = code & 0xff;
  }
  return out;
}

interface ByteWriter {
  readonly length: number;
  u8(v: number): ByteWriter;
  u16(v: number): ByteWriter;
  i16(v: number): ByteWriter;
  u32(v: number): ByteWriter;
  bytes(data: Uint8Array): ByteWriter;
  pad(multiple: number): ByteWriter;
  toBytes(): Uint8Array;
}

/** Wachsender Big-Endian-Puffer, lokal innerhalb eines Aufrufs. */
function byteWriter(): ByteWriter {
  const out: number[] = [];
  const w: ByteWriter = {
    get length() { return out.length; },
    u8: (v) => { out.push(v & 0xff); return w; },
    u16: (v) => { out.push((v >> 8) & 0xff, v & 0xff); return w; },
    i16: (v) => w.u16(v & 0xffff),
    u32: (v) => { out.push((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff); return w; },
    bytes: (data) => { for (const b of data) out.push(b); return w; },
    pad: (multiple) => { while (out.length % multiple !== 0) out.push(0); return w; },
    toBytes: () => Uint8Array.from(out),
  };
  return w;
}

const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function base64(data: Uint8Array): string {
  let out = "";
  for (let i = 0; i < data.length; i += 3) {
    const a = data[i]!;
    const b = data[i + 1];
    const c = data[i + 2];
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    out += BASE64[(n >> 18) & 63]! + BASE64[(n >> 12) & 63]!;
    out += b === undefined ? "=" : BASE64[(n >> 6) & 63]!;
    out += c === undefined ? "=" : BASE64[n & 63]!;
  }
  return out;
}
