/**
 * Makes an SVG unique for embedding into an HTML document that holds several diagrams:
 * `@font-face` and `id` are document-wide there. Without a prefix the embedded font subset
 * "Inter" would override a UI font of the same name (web app, Obsidian), and icon symbols of
 * two diagrams would reference each other. For display in the DOM only — exports and
 * `Analysis.svg` stay unchanged (byte-identical with the CLI).
 */
export function scopeSvg(svg: string, prefix: string): string {
  const families = new Set([...svg.matchAll(/@font-face\{font-family:"([^"]+)"/g)].map((m) => m[1]!));
  let scoped = svg
    .replace(/\bid="sa-/g, `id="${prefix}-`)
    .replace(/\bhref="#sa-/g, `href="#${prefix}-`)
    .replace(/\baria-labelledby="sa-/g, `aria-labelledby="${prefix}-`);
  for (const family of families) {
    scoped = scoped
      .replaceAll(`font-family:"${family}"`, `font-family:"${prefix}-${family}"`)
      .replaceAll(`font-family="${family},`, `font-family="${prefix}-${family},`);
  }
  return scoped;
}
