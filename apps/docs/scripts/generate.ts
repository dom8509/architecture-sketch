// Generates everything the documentation derives from the code — before every `vitepress dev|build`.
// None of it is checked in (.gitignore): library, icons, themes, examples, CLI help, concept pages
// and the rendered ```sysarch blocks are therefore always in sync with the code.
// Errors or warnings in a diagram of the docs break the build.
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CATEGORIES, compile, DIAGNOSTIC_CODES, projectView, SIGNAL_GROUPS, SIGNAL_KINDS, standardLibrary, THEMES,
  type Category, type IconDef, type SignalGroup, type TemplateDef,
} from "@sysarch/core";
import { AUTOMOTIVE_ARCHLIB } from "../../../packages/core/src/library/generated.js";
import { classify } from "../../../packages/editor/src/highlight.js";
import { renderArchitecture } from "@sysarch/render-svg";
import MarkdownIt from "markdown-it";
import { run } from "../../cli/src/cli.js";
import { blockKey, hasTheme, isDiagram, shareFragment, viewFlag } from "../.vitepress/blocks.mjs";

const DOCS = fileURLToPath(new URL("..", import.meta.url));
const ROOT = join(DOCS, "../..");
const GENERATED = join(DOCS, "_generated");
const PUBLIC = join(DOCS, "public/generated");
const CONCEPT = join(DOCS, "concept");
export const REPO = "https://github.com/dom8509/sysarch";

const LIGHT = "automotive-light";
const DARK = "automotive-dark";

// ── Texts the code does not know — every new value in the code needs an entry here ──

const CATEGORY_TITLES: Record<Category, string> = {
  power: "Supply & power",
  controller: "Compute & memory",
  communication: "Communication",
  sensor: "Sensors",
  actuator: "Actuators",
  software: "Software",
  external: "External",
  generic: "Generic",
};

const THEME_DESCRIPTIONS: Record<string, string> = {
  "automotive-light": "The default for documentation and notes in light mode.",
  "automotive-dark": "For dark surfaces — Obsidian in dark mode, on-screen presentations.",
  presentation: "Larger type, stronger lines, more spacing — for projectors and slides.",
  technical: "Black and white, optimized for print; signal groups differ only in line style.",
};

const GROUP_TITLES: Record<SignalGroup, [title: string, line: string]> = {
  supply: ["Supply", "thick line; `ground` ends with a ground symbol"],
  single: ["Single signal", "normal line"],
  bus: ["Bus", "double line"],
  diagnostic: ["Diagnostic", "dashed line"],
};

// ── Helpers ──────────────────────────────────────────────────────

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

/** Renders light and — without `theme` in the source — dark; returns the public paths. */
function renderVariants(source: string, name: string, view = ""): { light: string; dark?: string } {
  const { value: whole } = compile(source);
  const model = view ? projectView(whole, view) : whole;
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

// ── Concept documents (docs/*.md) ────────────────────────────────

function syncConcept() {
  const source = join(ROOT, "docs");
  const pages: { file: string; title: string }[] = [];
  for (const file of readdirSync(source).filter((f) => f.endsWith(".md")).sort()) {
    let text = readFileSync(join(source, file), "utf8");
    // links leaving docs/ point to GitHub; links between concept pages stay relative
    text = text.replace(/\]\(\.\.\/([^)\s]+)\)/g, (_, target: string) => {
      const kind = target.endsWith("/") || !/\.[a-z]+(#.*)?$/i.test(target) ? "tree" : "blob";
      return `](${REPO}/${kind}/main/${target})`;
    });
    write(join(CONCEPT, file), text);
    pages.push({ file, title: /^# (.+)$/m.exec(text)?.[1] ?? file });
  }
  write(join(CONCEPT, "index.md"), [
    "# Concept",
    "",
    "The concept documents describe **why** sysarch is built the way it is: language, data model,",
    "layout, rendering and decisions. They live in the repository under",
    `[\`docs/\`](${REPO}/tree/main/docs) and are copied here on every build.`,
    "",
    ...pages.map((p) => `- [${p.title}](./${p.file})`),
    "",
  ].join("\n"));
  return pages;
}

// ── Library ──────────────────────────────────────────────────────

function defineSource(name: string): string {
  const start = AUTOMOTIVE_ARCHLIB.search(new RegExp(`^define ${name}\\b`, "m"));
  if (start < 0) throw new Error(`define ${name} not found in automotive.archlib`);
  let depth = 0;
  for (let i = start; i < AUTOMOTIVE_ARCHLIB.length; i++) {
    const c = AUTOMOTIVE_ARCHLIB[i];
    if (c === "{") depth++;
    if (c === "}" && --depth === 0) return AUTOMOTIVE_ARCHLIB.slice(start, i + 1);
  }
  throw new Error(`define ${name}: closing brace missing`);
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

  out.push("## Overview", "");
  out.push("| Template | Label | Category | Shape | Icon | Pins |", "|---|---|---|---|---|---|");
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
  write(join(GENERATED, "library.md"), out.join("\n"));
  write(join(GENERATED, "icons.md"), icon.join("\n"));
  return templates;
}

function templateSection(t: TemplateDef): string[] {
  const source = `architecture "${t.name}" {\n    component ${t.name}: ${t.name}\n}\n`;
  check(`Library ${t.name}`, source);
  const paths = renderVariants(source, `library/${t.name}`);
  const facts = [
    t.label && `Label "${t.label}"`,
    `Category \`${t.category ?? "generic"}\``,
    `Size \`${t.size ?? "medium"}\``,
    `Shape \`${t.shape ?? "rounded"}\``,
    t.icon && `Icon \`${t.icon}\``,
    t.extends && `extends [\`${t.extends}\`](#${t.extends.replace(/_/g, "-")})`,
  ].filter(Boolean);
  const lines = [`### ${t.name}`, "", facts.join(" · "), "", figure(paths, t.label ?? t.name, "sysarch-figure sa-template"), ""];
  if (t.pins.length > 0) {
    lines.push("| Pin | Kind | Side |", "|---|---|---|");
    for (const p of t.pins) lines.push(`| \`${p.name}\` | \`${p.kind}\` | ${p.side ?? "from connections"} |`);
    lines.push("");
  }
  lines.push(fence(`component ${t.name}: ${t.name}`), "::: details Definition in `automotive.archlib`", fence(defineSource(t.name)), ":::", "");
  return lines;
}

// ── Themes, signal kinds, examples, CLI ──────────────────────────

function themes() {
  const source = readFileSync(join(ROOT, "examples/zonal-ecu.arch"), "utf8");
  const { value: model } = compile(source);
  const out: string[] = [];
  for (const theme of THEMES) {
    const description = THEME_DESCRIPTIONS[theme];
    if (!description) throw new Error(`Theme \`${theme}\` has no description in apps/docs/scripts/generate.ts`);
    write(join(PUBLIC, `themes/${theme}.svg`), renderArchitecture(model, theme));
    out.push(`## ${theme}`, "", description, "", figure({ light: `/generated/themes/${theme}.svg` }, `Zonal ECU in the ${theme} theme`), "");
  }
  write(join(GENERATED, "themes.md"), out.join("\n"));
}

function signalKinds() {
  const out = ["| Group | Kinds | Rendering |", "|---|---|---|"];
  for (const group of Object.keys(GROUP_TITLES) as SignalGroup[]) {
    const kinds = SIGNAL_KINDS.filter((k) => SIGNAL_GROUPS[k] === group);
    const [title, line] = GROUP_TITLES[group];
    out.push(`| ${title} | ${kinds.map((k) => `\`${k}\``).join(" ")} | ${line} |`);
  }
  write(join(GENERATED, "signal-kinds.md"), out.join("\n") + "\n");
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
  write(join(GENERATED, "examples.md"), out.join("\n"));
}

function cliHelp() {
  let help = "";
  run(["--help"], { stdout: (t) => (help += t), stderr: () => {} });
  write(join(GENERATED, "cli-help.md"), "```text\n" + help.replace(/\n*$/, "\n") + "```\n");
}

function diagnosticCodes() {
  write(join(GENERATED, "diagnostic-codes.json"), JSON.stringify(DIAGNOSTIC_CODES) + "\n");
}

// ── ```sysarch blocks of all pages ───────────────────────────────

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
      const view = viewFlag(flags);
      const key = blockKey(code, view);
      if (manifest[key]?.light) continue;
      const block: Block = { html: highlight(code) };
      // `sysarch code-only`: deliberately broken or incomplete examples
      if (isDiagram(code) && !flags.includes("code-only")) {
        check(`${where}:${(token.map?.[0] ?? 0) + 2}`, code);
        if (view && !compile(code).value.views.some((v) => v.id === view)) {
          failures.push(`${where}: block does not declare the view \`${view}\``);
        }
        Object.assign(block, renderVariants(code, `diagrams/${key}`, view), { share: shareFragment(code) });
      }
      manifest[key] = block;
    }
  }
  write(join(GENERATED, "blocks.json"), JSON.stringify(manifest) + "\n");
  return Object.keys(manifest).length;
}

// ── Run ──────────────────────────────────────────────────────────

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
  console.error("Diagrams in the documentation have diagnostics:\n" + failures.map((f) => `  ${f}`).join("\n"));
  process.exit(1);
}
console.log(`docs: ${concept.length} concept pages, ${templates.length} templates, ${THEMES.length} themes, ${count} sysarch blocks`);
