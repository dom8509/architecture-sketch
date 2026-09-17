import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { compile, DIAGNOSTIC_CODES, format } from "@sysarch/core";
import MarkdownIt from "markdown-it";
import { describe, expect, it } from "vitest";
import { isDiagram } from "../.vitepress/blocks.mjs";

// Hält die von Hand geschriebene Dokumentation mit dem Code synchron. Was sich aus dem Code
// erzeugen lässt, erzeugt scripts/generate.ts; hier geht es um den Rest.

const DOCS = join(import.meta.dirname, "..");
const ROOT = join(DOCS, "../..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");
const page = (path: string) => readFileSync(join(DOCS, path), "utf8");
const strings = (source: string, pattern: RegExp) => [...source.matchAll(pattern)].map((m) => m[1]!);

/** Von Hand geschriebene Seiten — ohne generierte Verzeichnisse. */
function pages(dir = DOCS): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith(".") || entry.name.startsWith("_") || ["node_modules", "public", "konzept", "test", "scripts"].includes(entry.name)) return [];
    const path = join(dir, entry.name);
    return entry.isDirectory() ? pages(path) : entry.name.endsWith(".md") ? [relative(DOCS, path)] : [];
  });
}

describe("Referenz Diagnosen", () => {
  it("hat für jeden Diagnosecode einen Abschnitt", () => {
    const headings = strings(page("referenz/diagnosen.md"), /^## (\S+)$/gm);
    expect(headings).toEqual([...DIAGNOSTIC_CODES]);
  });
});

describe("Anleitung Obsidian", () => {
  const text = page("anleitungen/obsidian.md");
  const sources = ["main.ts", "settings.ts", "block.ts", "exports.ts", "library-view.ts"]
    .map((file) => read(`apps/obsidian/src/${file}`)).join("\n");

  it("nennt jeden Befehl", () => {
    for (const name of strings(sources, /addCommand\(\{[^}]*?name: "([^"]+)"/gs)) expect(text, name).toContain(`**${name}**`);
  });

  it("nennt jede Einstellung", () => {
    for (const name of strings(sources, /\.setName\("([^"]+)"\)/g)) expect(text, name).toContain(`**${name}**`);
  });

  it("nennt jeden Menüeintrag", () => {
    for (const title of strings(sources, /\.setTitle\("([^"]+)"\)/g)) expect(text, title).toContain(`**${title}**`);
  });
});

describe("Anleitung Web-App", () => {
  it("nennt jede Schaltfläche", () => {
    const text = page("anleitungen/web-app.md");
    const html = read("apps/web/index.html");
    for (const label of strings(html, /<button[^>]*>([^<]+)<\/button>/g)) expect(text, label).toContain(`**${label}**`);
  });
});

describe("Referenz CLI", () => {
  it("erklärt jede Option", () => {
    const text = page("referenz/cli.md");
    for (const option of new Set(strings(read("apps/cli/src/cli.ts"), /(?<![\w-])(--[a-z][a-z-]+)/g))) {
      expect(text.replace(/<!--@include:[^>]*-->/g, ""), option).toContain(`\`${option}`);
    }
  });
});

describe("Navigation", () => {
  const config = readFileSync(join(DOCS, ".vitepress/config.mts"), "utf8");
  const links = strings(config, /link: "(\/[^"]*)"/g);
  const target = (link: string) => (link.endsWith("/") ? `${link.slice(1)}index.md` : `${link.slice(1)}.md`);

  it("verweist nur auf vorhandene Seiten", () => {
    const concept = readdirSync(join(ROOT, "docs")).map((f) => `konzept/${f}`);
    for (const link of links) {
      const file = target(link);
      if (file === "konzept/index.md") continue;
      expect([...pages(), ...concept], link).toContain(file);
    }
  });

  it("enthält jede Seite", () => {
    const linked = new Set(links.map(target));
    for (const file of pages().filter((f) => f !== "index.md")) expect(linked, file).toContain(file);
  });
});

describe("Diagramme in der Dokumentation", () => {
  const md = new MarkdownIt({ html: true });
  const diagrams = pages().flatMap((file) =>
    md.parse(page(file), {})
      .filter((t) => t.type === "fence" && t.info.trim() === "sysarch" && isDiagram(t.content))
      .map((t) => ({ where: `${file}:${(t.map?.[0] ?? 0) + 1}`, code: t.content })),
  );

  it("gibt es", () => {
    expect(diagrams.length).toBeGreaterThan(10);
  });

  it("sind ohne Fehler und Warnungen", () => {
    for (const { where, code } of diagrams) {
      const shown = compile(code).diagnostics.filter((d) => d.severity !== "info");
      expect(shown.map((d) => `${d.code} ${d.message}`), where).toEqual([]);
    }
  });

  it("sind kanonisch formatiert", () => {
    for (const { where, code } of diagrams) expect(format(code).value, where).toBe(code);
  });
});
