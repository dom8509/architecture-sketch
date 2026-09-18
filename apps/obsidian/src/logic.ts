import { CATEGORIES, parse, type Category, type Library, type TemplateDef } from "@sysarch/core";

// The plugin's pure functions — no Obsidian API, so that Vitest can test them directly.

/** Template for new code blocks and `.arch` files; without `theme`, so that it follows the Obsidian mode. */
export const NEW_SOURCE = `architecture "New architecture" {
    direction LR

    component battery: battery { label "KL30" }
    component mcu: microcontroller {
        pin power VDD
    }

    battery -> mcu.VDD
}
`;

/** `auto` follows the Obsidian mode; otherwise a name from `THEMES`. */
export type ThemeSetting = string;

/**
 * Theme for rendering: a `theme` in the source wins (then `undefined`, and the renderer
 * takes the one from the source), otherwise the setting, and for `auto` light or dark.
 */
export function effectiveTheme(source: string, setting: ThemeSetting, dark: boolean): string | undefined {
  const architecture = parse(source).value.architecture;
  if (architecture?.body.some((stmt) => stmt.kind === "Theme")) return undefined;
  if (setting !== "auto") return setting;
  return dark ? "automotive-dark" : "automotive-light";
}

/** File name without extension: the architecture title as a slug, otherwise the note name. */
export function exportBaseName(title: string, noteName: string): string {
  const slug = title
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return slug || noteName || "architecture";
}

/**
 * Replaces the content of a code block (the lines between the fences `lineStart` and `lineEnd`).
 * Returns `undefined` if the block no longer contains `expected` — nothing is overwritten then.
 */
export function replaceBlock(text: string, lineStart: number, lineEnd: number, expected: string, replacement: string): string | undefined {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(eol);
  if (lineEnd <= lineStart || lineEnd >= lines.length) return undefined;
  if (!/^\s*(`{3,}|~{3,})\s*sysarch\b/.test(lines[lineStart]!)) return undefined;
  const current = lines.slice(lineStart + 1, lineEnd).join("\n");
  if (trimEnd(current) !== trimEnd(expected.replace(/\r\n/g, "\n"))) return undefined;
  const body = trimEnd(replacement.replace(/\r\n/g, "\n")).split("\n");
  return [...lines.slice(0, lineStart + 1), ...body, ...lines.slice(lineEnd)].join(eol);
}

function trimEnd(text: string): string {
  return text.replace(/\n+$/, "");
}

/** Headings of the library view, in the order of `CATEGORIES`. */
export const CATEGORY_TITLES: Record<Category, string> = {
  power: "Power supply",
  controller: "ECUs & controllers",
  communication: "Communication",
  sensor: "Sensors",
  actuator: "Actuators",
  software: "Software",
  external: "External",
  generic: "Generic",
};

export interface LibraryGroup {
  category: Category;
  title: string;
  templates: TemplateDef[];
}

/**
 * Templates grouped by category and sorted by name; `query` filters over name, label, icon and
 * pins (case-insensitive). Empty groups are dropped.
 */
export function libraryGroups(library: Library, query = ""): LibraryGroup[] {
  const needle = query.trim().toLowerCase();
  const matches = (t: TemplateDef) =>
    needle === "" ||
    [t.name, t.label, t.icon, t.extends, ...t.pins.map((p) => p.name)]
      .some((text) => text?.toLowerCase().includes(needle));
  const templates = [...library.templates.values()].filter(matches).sort((a, b) => a.name.localeCompare(b.name));
  return CATEGORIES
    .map((category) => ({
      category,
      title: CATEGORY_TITLES[category],
      templates: templates.filter((t) => (t.category ?? "generic") === category),
    }))
    .filter((group) => group.templates.length > 0);
}

/** Minimal architecture with exactly one component of the template — for the preview. */
export function templatePreviewSource(template: TemplateDef): string {
  return `architecture "${template.name}" {\n    component ${template.name}: ${template.name}\n}\n`;
}

/** The line to insert into a source. */
export function componentSnippet(template: TemplateDef): string {
  return `component ${template.name}: ${template.name}`;
}
