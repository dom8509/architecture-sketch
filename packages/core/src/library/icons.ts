import type { IconDef } from "../resolve/library.js";

const ALLOWED = new Set(["svg", "g", "path", "circle", "rect", "line", "polyline", "polygon"]);
/** Attribute, die das Theme setzt oder die keine Wirkung auf die Geometrie haben. */
const PRESENTATION = new Set([
  "xmlns", "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin",
  "stroke-miterlimit", "fill-rule", "clip-rule", "class", "id", "width", "height",
]);

interface Element {
  name: string;
  attributes: Map<string, string>;
}

export class IconError extends Error {}

const num = (value: number) => {
  const rounded = Math.round(value * 1000) / 1000;
  return Object.is(rounded, -0) ? "0" : String(rounded);
};

/**
 * Wandelt eine Icon-Datei in reine Pfaddaten um und prüft die Regeln aus
 * library/icons/README.md. Verstöße werfen `IconError`.
 */
export function convertIcon(name: string, svg: string): IconDef {
  const fail = (message: string): never => {
    throw new IconError(`Icon \`${name}\`: ${message}`);
  };

  const source = svg.replace(/<\?xml[\s\S]*?\?>/g, "").replace(/<!--[\s\S]*?-->/g, "");
  const elements: IconDef["elements"] = [];
  /** Geerbter Füllwert je offener Ebene. */
  const fillStack: (string | undefined)[] = [];
  let sawRoot = false;
  let pos = 0;

  const tagPattern = /<(\/?)([A-Za-z][\w:-]*)((?:\s+[\w:-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/y;
  const attributePattern = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

  while (pos < source.length) {
    const lt = source.indexOf("<", pos);
    const text = source.slice(pos, lt === -1 ? source.length : lt);
    if (text.trim() !== "") fail(`Text außerhalb von Elementen ist nicht erlaubt: \`${text.trim().slice(0, 20)}\``);
    if (lt === -1) break;

    tagPattern.lastIndex = lt;
    const match = tagPattern.exec(source);
    if (match === null) fail(`ungültiges oder nicht unterstütztes Markup bei Offset ${lt}`);
    const [whole, closing, tagName, rawAttributes, selfClosing] = match!;
    pos = lt + whole.length;

    if (closing) {
      fillStack.pop();
      continue;
    }
    if (!ALLOWED.has(tagName!)) fail(`Element \`<${tagName}>\` ist nicht erlaubt`);

    const element: Element = { name: tagName!, attributes: new Map() };
    for (const a of rawAttributes!.matchAll(attributePattern)) {
      element.attributes.set(a[1]!, a[2] ?? a[3] ?? "");
    }
    for (const attribute of element.attributes.keys()) {
      if (attribute === "viewBox" || PRESENTATION.has(attribute) || isGeometry(element.name, attribute)) continue;
      fail(`Attribut \`${attribute}\` an \`<${element.name}>\` ist nicht erlaubt`);
    }

    if (element.name === "svg") {
      if (sawRoot) fail("verschachteltes `<svg>` ist nicht erlaubt");
      sawRoot = true;
      if (element.attributes.get("viewBox")?.trim().replace(/\s+/g, " ") !== "0 0 24 24") {
        fail('`viewBox="0 0 24 24"` fehlt');
      }
    } else if (!sawRoot) {
      fail("Wurzelelement muss `<svg>` sein");
    } else if (element.attributes.has("viewBox")) {
      fail(`Attribut \`viewBox\` an \`<${element.name}>\` ist nicht erlaubt`);
    }

    const fill = element.attributes.get("fill") ?? fillStack[fillStack.length - 1];
    if (element.name !== "svg" && element.name !== "g") {
      elements.push({ d: toPath(element, fail), mode: fill === undefined || fill === "none" ? "stroke" : "fill" });
    }
    if (!selfClosing) fillStack.push(fill);
  }

  if (!sawRoot) fail("kein `<svg>`-Element gefunden");
  if (elements.length === 0) fail("enthält keine Formen");
  return { name, viewBox: "0 0 24 24", elements };
}

const GEOMETRY: Readonly<Record<string, readonly string[]>> = {
  path: ["d"],
  circle: ["cx", "cy", "r"],
  rect: ["x", "y", "width", "height", "rx", "ry"],
  line: ["x1", "y1", "x2", "y2"],
  polyline: ["points"],
  polygon: ["points"],
};

function isGeometry(element: string, attribute: string): boolean {
  return GEOMETRY[element]?.includes(attribute) ?? false;
}

function toPath(element: Element, fail: (message: string) => never): string {
  const a = element.attributes;
  const n = (key: string, fallback?: number): number => {
    const raw = a.get(key);
    if (raw === undefined) {
      if (fallback !== undefined) return fallback;
      return fail(`\`<${element.name}>\` braucht \`${key}\``);
    }
    const value = Number(raw);
    if (!Number.isFinite(value)) fail(`\`${key}="${raw}"\` ist keine Zahl`);
    return value;
  };

  switch (element.name) {
    case "path": {
      const d = a.get("d")?.trim();
      if (!d) fail("`<path>` braucht `d`");
      if (!/^[MmLlHhVvCcSsQqTtAaZz0-9eE.,+\-\s]+$/.test(d!)) fail("`d` enthält ungültige Zeichen");
      return d!;
    }
    case "circle": {
      const cx = n("cx", 0), cy = n("cy", 0), r = n("r");
      return `M${num(cx - r)} ${num(cy)}a${num(r)} ${num(r)} 0 1 0 ${num(2 * r)} 0a${num(r)} ${num(r)} 0 1 0 ${num(-2 * r)} 0Z`;
    }
    case "rect": {
      const x = n("x", 0), y = n("y", 0), w = n("width"), h = n("height");
      let rx = a.has("rx") ? n("rx") : a.has("ry") ? n("ry") : 0;
      let ry = a.has("ry") ? n("ry") : rx;
      rx = Math.min(rx, w / 2);
      ry = Math.min(ry, h / 2);
      if (rx === 0 || ry === 0) return `M${num(x)} ${num(y)}h${num(w)}v${num(h)}h${num(-w)}Z`;
      return (
        `M${num(x + rx)} ${num(y)}h${num(w - 2 * rx)}a${num(rx)} ${num(ry)} 0 0 1 ${num(rx)} ${num(ry)}` +
        `v${num(h - 2 * ry)}a${num(rx)} ${num(ry)} 0 0 1 ${num(-rx)} ${num(ry)}` +
        `h${num(-(w - 2 * rx))}a${num(rx)} ${num(ry)} 0 0 1 ${num(-rx)} ${num(-ry)}` +
        `v${num(-(h - 2 * ry))}a${num(rx)} ${num(ry)} 0 0 1 ${num(rx)} ${num(-ry)}Z`
      );
    }
    case "line":
      return `M${num(n("x1", 0))} ${num(n("y1", 0))}L${num(n("x2", 0))} ${num(n("y2", 0))}`;
    case "polyline":
    case "polygon": {
      const values = (a.get("points") ?? "").trim().split(/[\s,]+/).filter(Boolean).map(Number);
      if (values.length < 4 || values.length % 2 !== 0 || values.some((v) => !Number.isFinite(v))) {
        fail(`\`<${element.name}>\` hat ungültige \`points\``);
      }
      const pairs: string[] = [];
      for (let k = 0; k < values.length; k += 2) pairs.push(`${num(values[k]!)} ${num(values[k + 1]!)}`);
      return `M${pairs.join("L")}${element.name === "polygon" ? "Z" : ""}`;
    }
  }
  return fail(`Element \`<${element.name}>\` ist nicht erlaubt`);
}
