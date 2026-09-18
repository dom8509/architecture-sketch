export type PngScale = 1 | 2 | 3;

export const PNG_SCALES: readonly PngScale[] = [1, 2, 3];

/** Width and height in px from the root element of a sysarch SVG. */
export function svgSize(svg: string): { width: number; height: number } {
  const root = /<svg\b[^>]*>/.exec(svg)?.[0] ?? "";
  const attribute = (name: string) => Number(new RegExp(`\\s${name}="([\\d.]+)"`).exec(root)?.[1]);
  const width = attribute("width");
  const height = attribute("height");
  if (!(width > 0) || !(height > 0)) throw new Error("SVG without a valid width/height");
  return { width, height };
}

/**
 * Rasterizes a standalone SVG to PNG in the browser (2x by default). The font is embedded
 * in the SVG; drawing starts only once the document fonts and the image have loaded.
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
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not create the PNG"))), "image/png"));
}
