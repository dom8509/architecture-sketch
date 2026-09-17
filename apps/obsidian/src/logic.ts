import { parse } from "@sysarch/core";

// Reine Funktionen des Plugins — ohne Obsidian-API, damit Vitest sie direkt prüfen kann.

/** Vorlage für neue Codeblöcke und `.arch`-Dateien; ohne `theme`, damit sie dem Obsidian-Modus folgt. */
export const NEW_SOURCE = `architecture "Neue Architektur" {
    direction LR

    component battery: battery { label "KL30" }
    component mcu: microcontroller {
        pin power VDD
    }

    battery -> mcu.VDD
}
`;

/** `auto` folgt dem Obsidian-Modus; sonst ein Name aus `THEMES`. */
export type ThemeSetting = string;

/**
 * Theme für die Darstellung: Ein `theme` in der Quelle hat Vorrang (dann `undefined`, der
 * Renderer nimmt das der Quelle), sonst die Einstellung, bei `auto` hell bzw. dunkel.
 */
export function effectiveTheme(source: string, setting: ThemeSetting, dark: boolean): string | undefined {
  const architecture = parse(source).value.architecture;
  if (architecture?.body.some((stmt) => stmt.kind === "Theme")) return undefined;
  if (setting !== "auto") return setting;
  return dark ? "automotive-dark" : "automotive-light";
}

/** Dateiname ohne Endung: Titel der Architektur als Slug, sonst der Name der Notiz. */
export function exportBaseName(title: string, noteName: string): string {
  const slug = title
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return slug || noteName || "architektur";
}

/**
 * Ersetzt den Inhalt eines Codeblocks (Zeilen zwischen den Zäunen `lineStart` und `lineEnd`).
 * Gibt `undefined` zurück, wenn der Block inzwischen nicht mehr `expected` enthält — dann
 * wird nichts überschrieben.
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
