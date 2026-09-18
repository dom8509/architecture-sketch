// Shared by scripts/generate.ts and the markdown extension in config.mts: both must derive
// the same key for the same ```sysarch block.
import { createHash } from "node:crypto";
import { deflateRawSync } from "node:zlib";

/** Base URL on GitHub Pages (https://dom8509.github.io/sysarch/). */
export const BASE = "/sysarch/";

/** A block with `architecture "…"` is rendered as a diagram; everything else is a snippet. */
export const isDiagram = (code) => /^architecture\s+"/m.test(code);

/** If the block sets a theme itself, there is no dark variant. */
export const hasTheme = (code) => /^\s*theme\s+\S+/m.test(code);

export const blockKey = (code) => createHash("sha256").update(code).digest("hex").slice(0, 16);

/** The web app's `#src=…` fragment (deflate-raw, base64url — as in apps/web/src/share.ts). */
export const shareFragment = (code) => `#src=${deflateRawSync(Buffer.from(code)).toString("base64url")}`;
