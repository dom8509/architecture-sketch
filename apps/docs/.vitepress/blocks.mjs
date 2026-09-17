// Gemeinsam für scripts/generate.ts und die Markdown-Erweiterung in config.mts: beide müssen
// denselben Schlüssel für denselben ```sysarch-Block bilden.
import { createHash } from "node:crypto";
import { deflateRawSync } from "node:zlib";

/** Basis-URL auf GitHub Pages (https://dom8509.github.io/sysarch/). */
export const BASE = "/sysarch/";

/** Ein Block mit `architecture "…"` wird als Diagramm gerendert; alles andere ist ein Ausschnitt. */
export const isDiagram = (code) => /^architecture\s+"/m.test(code);

/** Setzt der Block selbst ein Theme, gibt es keine Dunkel-Variante. */
export const hasTheme = (code) => /^\s*theme\s+\S+/m.test(code);

export const blockKey = (code) => createHash("sha256").update(code).digest("hex").slice(0, 16);

/** Fragment `#src=…` der Web-App (deflate-raw, base64url — wie apps/web/src/share.ts). */
export const shareFragment = (code) => `#src=${deflateRawSync(Buffer.from(code)).toString("base64url")}`;
