/** DSL compressed (deflate-raw, base64url) in the URL fragment `#src=…` — links without a server. */
export async function encodeSource(source: string): Promise<string> {
  const stream = new Blob([source]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function decodeSource(encoded: string): Promise<string> {
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Response(stream).text();
}

export function sourceFromHash(hash: string): string | undefined {
  const match = /^#src=([A-Za-z0-9_-]+)$/.exec(hash);
  return match?.[1];
}
