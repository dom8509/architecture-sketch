/**
 * Macht ein SVG für die Einbettung in ein HTML-Dokument mit mehreren Diagrammen eindeutig:
 * `@font-face` und `id` gelten dort dokumentweit. Ohne Präfix überschriebe das eingebettete
 * Schrift-Subset „Inter“ eine gleichnamige Oberflächenschrift (Web-App, Obsidian), und
 * Icon-Symbole zweier Diagramme verwiesen aufeinander. Nur für die Anzeige im DOM — Exporte
 * und `Analysis.svg` bleiben unverändert (byte-gleich mit der CLI).
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
