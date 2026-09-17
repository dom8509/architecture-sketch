export type PngScale = 1 | 2 | 3;

export const PNG_SCALES: readonly PngScale[] = [1, 2, 3];

/** Breite und Höhe in px aus dem Wurzelelement eines sysarch-SVGs. */
export function svgSize(svg: string): { width: number; height: number } {
  const root = /<svg\b[^>]*>/.exec(svg)?.[0] ?? "";
  const attribute = (name: string) => Number(new RegExp(`\\s${name}="([\\d.]+)"`).exec(root)?.[1]);
  const width = attribute("width");
  const height = attribute("height");
  if (!(width > 0) || !(height > 0)) throw new Error("SVG ohne gültige width/height");
  return { width, height };
}

/**
 * Rasterisiert ein eigenständiges SVG im Browser zu PNG (Standard 2×). Die Schrift ist im
 * SVG eingebettet; gezeichnet wird erst, wenn Dokumentschriften und Bild geladen sind.
 */
export async function svgToPng(svg: string, scale: PngScale = 2): Promise<Blob> {
  const { width, height } = svgSize(svg);
  const image = new Image();
  image.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  await Promise.all([image.decode(), document.fonts.ready]);

  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(w, h);
    canvas.getContext("2d")!.drawImage(image, 0, 0, w, h);
    return canvas.convertToBlob({ type: "image/png" });
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(image, 0, 0, w, h);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("PNG konnte nicht erzeugt werden"))), "image/png"));
}
