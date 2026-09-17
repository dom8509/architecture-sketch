// Erzeugt alles, was die Dokumentation aus dem Code ableitet — vor jedem `vitepress dev|build`.
// Nichts davon wird eingecheckt (.gitignore): Bibliothek, Icons, Themes, Beispiele, CLI-Hilfe,
// Konzeptseiten und die gerenderten ```sysarch-Blöcke sind damit immer auf dem Stand des Codes.
// Fehler oder Warnungen in einem Diagramm der Doku brechen den Build.
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CATEGORIES, compile, DIAGNOSTIC_CODES, SIGNAL_GROUPS, SIGNAL_KINDS, standardLibrary, THEMES,
  type Category, type IconDef, type SignalGroup, type TemplateDef,
} from "@sysarch/core";
import { AUTOMOTIVE_ARCHLIB } from "../../../packages/core/src/library/generated.js";
import { classify } from "../../../packages/editor/src/highlight.js";
import { renderArchitecture } from "@sysarch/render-svg";
import MarkdownIt from "markdown-it";
import { run } from "../../cli/src/cli.js";
import { blockKey, hasTheme, isDiagram, shareFragment } from "../.vitepress/blocks.mjs";

const DOCS = fileURLToPath(new URL("..", import.meta.url));
const ROOT = join(DOCS, "../..");
const GENERATED = join(DOCS, "_generated");
const PUBLIC = join(DOCS, "public/generated");
const CONCEPT = join(DOCS, "konzept");
export const REPO = "https://github.com/dom8509/sysarch";

const LIGHT = "automotive-light";
const DARK = "automotive-dark";

// ── Texte, die der Code nicht kennt — jeder neue Wert im Code muss hier ergänzt werden ──

const CATEGORY_TITLES: Record<Category, string> = {
  power: "Versorgung & Leistung",
  controller: "Rechnen & Speicher",
  communication: "Kommunikation",
  sensor: "Sensorik",
  actuator: "Aktorik",
  software: "Software",
  external: "Extern",
  generic: "Generisch",
};

const THEME_DESCRIPTIONS: Record<string, string> = {
  "automotive-light": "Standard für Dokumentation und Notizen im hellen Modus.",
  "automotive-dark": "Für dunkle Oberflächen — Obsidian dunkel, Bildschirmpräsentationen.",
  presentation: "Größere Schrift, kräftigere Linien, mehr Abstand — für Beamer und Folien.",
  technical: "Schwarz-weiß und druckoptimiert; Signalgruppen unterscheiden sich nur über die Linienform.",
};

const GROUP_TITLES: Record<SignalGroup, [title: string, line: string]> = {
  supply: ["Versorgung", "dicke Linie; `ground` endet mit Masse-Symbol"],
  single: ["Einzelsignal", "normale Linie"],
  bus: ["Bus", "Doppellinie"],
  diagnostic: ["Diagnose", "gestrichelte Linie"],
};

// ── Hilfen ───────────────────────────────────────────────────────

const write = (file: string, content: string) => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
};
const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fence = (code: string) => "```sysarch\n" + code.replace(/\n*$/, "\n") + "```\n";
const failures: string[] = [];

function check(where: string, source: string) {
  const { diagnostics } = compile(source);
  for (const d of diagnostics.filter((d) => d.severity !== "info")) {
    failures.push(`${where}:${d.span.line}:${d.span.column}: ${d.severity} ${d.code}: ${d.message}`);
  }
}

/** Rendert hell und — ohne `theme` in der Quelle — dunkel; liefert die öffentlichen Pfade. */
function renderVariants(source: string, name: string): { light: string; dark?: string } {
  const { value: model } = compile(source);
  if (hasTheme(source)) {
    write(join(PUBLIC, `${name}.svg`), renderArchitecture(model));
    return { light: `/generated/${name}.svg` };
  }
  write(join(PUBLIC, `${name}.svg`), renderArchitecture(model, LIGHT));
  write(join(PUBLIC, `${name}-dark.svg`), renderArchitecture(model, DARK));
  return { light: `/generated/${name}.svg`, dark: `/generated/${name}-dark.svg` };
}

function figure(paths: { light: string; dark?: string }, alt: string, cls = "sysarch-figure"): string {
  const img = (src: string, variant: string) => `<img class="${variant}" src="${src}" alt="${escapeHtml(alt)}" loading="lazy">`;
  return paths.dark
    ? `<figure class="${cls}">${img(paths.light, "sa-light")}${img(paths.dark, "sa-dark")}</figure>`
    : `<figure class="${cls}">${img(paths.light, "")}</figure>`;
}

// ── Konzeptdokumente (docs/*.md) ─────────────────────────────────

function syncConcept() {
  const source = join(ROOT, "docs");
  const pages: { file: string; title: string }[] = [];
  for (const file of readdirSync(source).filter((f) => f.endsWith(".md")).sort()) {
    let text = readFileSync(join(source, file), "utf8");
    // Verweise aus docs/ hinaus zeigen auf GitHub; Verweise zwischen Konzeptseiten bleiben relativ
    text = text.replace(/\]\(\.\.\/([^)\s]+)\)/g, (_, target: string) => {
      const kind = target.endsWith("/") || !/\.[a-z]+(#.*)?$/i.test(target) ? "tree" : "blob";
      return `](${REPO}/${kind}/main/${target})`;
    });
    write(join(CONCEPT, file), text);
    pages.push({ file, title: /^# (.+)$/m.exec(text)?.[1] ?? file });
  }
  write(join(CONCEPT, "index.md"), [
    "# Konzept",
    "",
    "Die Konzeptdokumente beschreiben, **warum** sysarch so gebaut ist: Sprache, Datenmodell,",
    "Layout, Rendering und Entscheidungen. Sie liegen im Repository unter",
    `[\`docs/\`](${REPO}/tree/main/docs) und werden bei jedem Build hierher übernommen.`,
    "",
    ...pages.map((p) => `- [${p.title}](./${p.file})`),
    "",
  ].join("\n"));
  return pages;
}

// ── Bibliothek ───────────────────────────────────────────────────

function defineSource(name: string): string {
  const start = AUTOMOTIVE_ARCHLIB.search(new RegExp(`^define ${name}\\b`, "m"));
  if (start < 0) throw new Error(`define ${name} nicht in automotive.archlib gefunden`);
  let depth = 0;
  for (let i = start; i < AUTOMOTIVE_ARCHLIB.length; i++) {
    const c = AUTOMOTIVE_ARCHLIB[i];
    if (c === "{") depth++;
    if (c === "}" && --depth === 0) return AUTOMOTIVE_ARCHLIB.slice(start, i + 1);
  }
  throw new Error(`define ${name}: schließende Klammer fehlt`);
}

function iconSvg(icon: IconDef, size = 24): string {
  const paths = icon.elements.map((e) =>
    e.mode === "fill"
      ? `<path d="${e.d}" fill="currentColor" stroke="none"/>`
      : `<path d="${e.d}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>`,
  );
  return `<svg class="sa-icon" viewBox="${icon.viewBox}" width="${size}" height="${size}" aria-hidden="true">${paths.join("")}</svg>`;
}

function library() {
  const lib = standardLibrary();
  const templates = [...lib.templates.values()].sort((a, b) => a.name.localeCompare(b.name));
  const out: string[] = [];

  out.push("## Übersicht", "");
  out.push("| Template | Label | Kategorie | Form | Icon | Pins |", "|---|---|---|---|---|---|");
  for (const t of templates) {
    out.push(`| [\`${t.name}\`](#${t.name.replace(/_/g, "-")}) | ${t.label ?? "—"} | \`${t.category ?? "generic"}\` | \`${t.shape ?? "rounded"}\` | ${t.icon ? `\`${t.icon}\`` : "—"} | ${t.pins.length} |`);
  }
  out.push("");

  for (const category of CATEGORIES) {
    const group = templates.filter((t) => (t.category ?? "generic") === category);
    if (group.length === 0) continue;
    out.push(`## ${CATEGORY_TITLES[category]}`, "");
    for (const t of group) out.push(...templateSection(t));
  }

  const icons = [...lib.icons.values()].sort((a, b) => a.name.localeCompare(b.name));
  const icon = [
    '<div class="sa-icon-grid">',
    ...icons.map((i) => `<div class="sa-icon-cell">${iconSvg(i, 32)}<code>${i.name}</code></div>`),
    "</div>",
    "",
  ];
  write(join(GENERATED, "bibliothek.md"), out.join("\n"));
  write(join(GENERATED, "icons.md"), icon.join("\n"));
  return templates;
}

function templateSection(t: TemplateDef): string[] {
  const source = `architecture "${t.name}" {\n    component ${t.name}: ${t.name}\n}\n`;
  check(`Bibliothek ${t.name}`, source);
  const paths = renderVariants(source, `library/${t.name}`);
  const facts = [
    t.label && `Label „${t.label}“`,
    `Kategorie \`${t.category ?? "generic"}\``,
    `Größe \`${t.size ?? "medium"}\``,
    `Form \`${t.shape ?? "rounded"}\``,
    t.icon && `Icon \`${t.icon}\``,
    t.extends && `erweitert [\`${t.extends}\`](#${t.extends.replace(/_/g, "-")})`,
  ].filter(Boolean);
  const lines = [`### ${t.name}`, "", facts.join(" · "), "", figure(paths, t.label ?? t.name, "sysarch-figure sa-template"), ""];
  if (t.pins.length > 0) {
    lines.push("| Pin | Art | Seite |", "|---|---|---|");
    for (const p of t.pins) lines.push(`| \`${p.name}\` | \`${p.kind}\` | ${p.side ?? "aus Verbindungen"} |`);
    lines.push("");
  }
  lines.push(fence(`component ${t.name}: ${t.name}`), "::: details Definition in `automotive.archlib`", fence(defineSource(t.name)), ":::", "");
  return lines;
}

// ── Themes, Signalarten, Beispiele, CLI ──────────────────────────

function themes() {
  const source = readFileSync(join(ROOT, "examples/zonal-ecu.arch"), "utf8");
  const { value: model } = compile(source);
  const out: string[] = [];
  for (const theme of THEMES) {
    const description = THEME_DESCRIPTIONS[theme];
    if (!description) throw new Error(`Theme \`${theme}\` hat keine Beschreibung in apps/docs/scripts/generate.ts`);
    write(join(PUBLIC, `themes/${theme}.svg`), renderArchitecture(model, theme));
    out.push(`## ${theme}`, "", description, "", figure({ light: `/generated/themes/${theme}.svg` }, `Zonal ECU im Theme ${theme}`), "");
  }
  write(join(GENERATED, "themes.md"), out.join("\n"));
}

function signalKinds() {
  const out = ["| Gruppe | Arten | Darstellung |", "|---|---|---|"];
  for (const group of Object.keys(GROUP_TITLES) as SignalGroup[]) {
    const kinds = SIGNAL_KINDS.filter((k) => SIGNAL_GROUPS[k] === group);
    const [title, line] = GROUP_TITLES[group];
    out.push(`| ${title} | ${kinds.map((k) => `\`${k}\``).join(" ")} | ${line} |`);
  }
  write(join(GENERATED, "signalarten.md"), out.join("\n") + "\n");
}

function examples() {
  const dir = join(ROOT, "examples");
  const out: string[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".arch")).sort()) {
    const source = readFileSync(join(dir, file), "utf8");
    const title = /^architecture\s+"([^"]+)"/m.exec(source)?.[1] ?? file;
    const intro = source.split("\n").filter((l) => l.startsWith("//")).slice(0, 3)
      .map((l) => l.replace(/^\/\/\s?/, "")).join(" ").replace(/^.*?—\s*/, "");
    out.push(`## ${title}`, "", `[\`examples/${file}\`](${REPO}/blob/main/examples/${file})${intro ? ` — ${intro}` : ""}`, "", fence(source), "");
  }
  write(join(GENERATED, "beispiele.md"), out.join("\n"));
}

function cliHelp() {
  let help = "";
  run(["--help"], { stdout: (t) => (help += t), stderr: () => {} });
  write(join(GENERATED, "cli-help.md"), "```text\n" + help.replace(/\n*$/, "\n") + "```\n");
}

function diagnosticCodes() {
  write(join(GENERATED, "diagnostic-codes.json"), JSON.stringify(DIAGNOSTIC_CODES) + "\n");
}

// ── ```sysarch-Blöcke aller Seiten ───────────────────────────────

interface Block {
  html: string;
  light?: string;
  dark?: string;
  share?: string;
}

function highlight(code: string): string {
  let html = "";
  let pos = 0;
  for (const r of classify(code)) {
    if (r.start < pos || r.end <= r.start) continue;
    html += escapeHtml(code.slice(pos, r.start));
    html += r.class === "invalid"
      ? escapeHtml(code.slice(r.start, r.end))
      : `<span class="sa-tok-${r.class}">${escapeHtml(code.slice(r.start, r.end))}</span>`;
    pos = r.end;
  }
  return html + escapeHtml(code.slice(pos));
}

function markdownFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "public") return [];
    const path = join(dir, entry.name);
    return entry.isDirectory() ? markdownFiles(path) : entry.name.endsWith(".md") ? [path] : [];
  });
}

function blocks() {
  const md = new MarkdownIt({ html: true });
  const manifest: Record<string, Block> = {};
  for (const file of markdownFiles(DOCS)) {
    const where = relative(DOCS, file);
    for (const token of md.parse(readFileSync(file, "utf8"), {})) {
      const [lang, ...flags] = token.info.trim().split(/\s+/);
      if (token.type !== "fence" || lang !== "sysarch") continue;
      const code = token.content;
      const key = blockKey(code);
      if (manifest[key]?.light) continue;
      const block: Block = { html: highlight(code) };
      // `sysarch nur-code`: absichtlich fehlerhafte oder unvollständige Beispiele
      if (isDiagram(code) && !flags.includes("nur-code")) {
        check(`${where}:${(token.map?.[0] ?? 0) + 2}`, code);
        Object.assign(block, renderVariants(code, `diagrams/${key}`), { share: shareFragment(code) });
      }
      manifest[key] = block;
    }
  }
  write(join(GENERATED, "blocks.json"), JSON.stringify(manifest) + "\n");
  return Object.keys(manifest).length;
}

// ── Ablauf ───────────────────────────────────────────────────────

for (const dir of [GENERATED, PUBLIC, CONCEPT]) rmSync(dir, { recursive: true, force: true });
const concept = syncConcept();
const templates = library();
themes();
signalKinds();
examples();
cliHelp();
diagnosticCodes();
const count = blocks();

if (failures.length > 0) {
  console.error("Diagramme in der Dokumentation haben Diagnosen:\n" + failures.map((f) => `  ${f}`).join("\n"));
  process.exit(1);
}
console.log(`docs: ${concept.length} Konzeptseiten, ${templates.length} Templates, ${THEMES.length} Themes, ${count} sysarch-Blöcke`);
