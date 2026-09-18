import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type MarkdownIt from "markdown-it";
import { defineConfig } from "vitepress";
import { BASE, blockKey } from "./blocks.mjs";

const REPO = "https://github.com/dom8509/sysarch";
const MANIFEST = fileURLToPath(new URL("../_generated/blocks.json", import.meta.url));
const building = process.argv.includes("build");

interface Block {
  html: string;
  light?: string;
  dark?: string;
  share?: string;
}

const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** ```sysarch: highlighting as in the editor, and for `architecture "…"` the rendered diagram above it. */
function sysarchBlocks(md: MarkdownIt) {
  const fallback = md.renderer.rules.fence!;
  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx]!;
    const [lang, ...flags] = token.info.trim().split(/\s+/);
    if (lang !== "sysarch") return fallback(tokens, idx, options, env, self);
    // read again on every call: `npm run generate` while `vitepress dev` is running
    const manifest: Record<string, Block> = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};
    const block = manifest[blockKey(token.content)];
    if (!block) {
      const message = `sysarch block not generated (${env.relativePath}) — run \`npm run generate -w @sysarch/docs\``;
      if (building) throw new Error(message);
      console.warn(message);
    }
    const code =
      `<div class="language-sysarch vp-adaptive-theme"><button title="Copy code" class="copy"></button>` +
      `<span class="lang">sysarch</span><pre class="vp-code"><code>${block?.html ?? escapeHtml(token.content)}</code></pre></div>`;
    if (!block?.light || flags.includes("code-only")) return code;
    const img = (src: string, cls: string) => `<img class="${cls}" src="${src}" alt="Diagram" loading="lazy">`;
    return (
      `<div class="sysarch-example"><figure class="sysarch-figure">` +
      (block.dark ? img(block.light, "sa-light") + img(block.dark, "sa-dark") : img(block.light, "")) +
      `<figcaption><a href="${BASE}app/${block.share}" target="_blank" rel="noopener">Open in the web app ↗</a></figcaption>` +
      `</figure>${code}</div>`
    );
  };
}

export default defineConfig({
  lang: "en-US",
  title: "sysarch",
  description: "Architecture-as-Code for embedded and system architectures",
  base: BASE,
  cleanUrls: true,
  lastUpdated: true,
  srcExclude: ["_generated/**", "README.md"],
  // the web app sits next to the docs under /app/ and is not a VitePress page
  ignoreDeadLinks: [/^\/app\//],
  head: [["link", { rel: "icon", href: `${BASE}logo.svg` }]],

  markdown: { config: sysarchBlocks },

  themeConfig: {
    logo: "/logo.svg",
    nav: [
      { text: "Quickstart", link: "/getting-started/quickstart" },
      { text: "Guides", link: "/guides/" },
      { text: "Reference", link: "/reference/language" },
      { text: "Concept", link: "/concept/" },
      { text: "Web app", link: `${BASE}app/`, target: "_blank" },
    ],
    sidebar: [
      {
        text: "Getting started",
        items: [
          { text: "What is sysarch?", link: "/getting-started/" },
          { text: "Quickstart", link: "/getting-started/quickstart" },
          { text: "Installation", link: "/getting-started/installation" },
        ],
      },
      {
        text: "Guides",
        items: [
          { text: "Overview", link: "/guides/" },
          { text: "Pins and connections", link: "/guides/pins-and-connections" },
          { text: "Zones and systems", link: "/guides/zones-and-systems" },
          { text: "Controlling the layout", link: "/guides/layout" },
          { text: "Presentation views", link: "/guides/presentation" },
          { text: "Custom templates", link: "/guides/templates" },
          { text: "Web app", link: "/guides/web-app" },
          { text: "Obsidian", link: "/guides/obsidian" },
          { text: "CLI and CI", link: "/guides/cli-and-ci" },
          { text: "Export to React Flow", link: "/guides/react-flow" },
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "Language", link: "/reference/language" },
          { text: "Library", link: "/reference/library" },
          { text: "Icons", link: "/reference/icons" },
          { text: "Themes", link: "/reference/themes" },
          { text: "Diagnostics", link: "/reference/diagnostics" },
          { text: "CLI", link: "/reference/cli" },
          { text: "Examples", link: "/reference/examples" },
        ],
      },
      {
        text: "Concept",
        collapsed: true,
        items: [
          { text: "Overview", link: "/concept/" },
          { text: "01 Vision", link: "/concept/01-vision" },
          { text: "02 DSL", link: "/concept/02-dsl" },
          { text: "03 Domain model", link: "/concept/03-domain-model" },
          { text: "04 Layout & routing", link: "/concept/04-layout" },
          { text: "05 Rendering & export", link: "/concept/05-rendering-export" },
          { text: "06 Applications", link: "/concept/06-applications" },
          { text: "07 Repository", link: "/concept/07-repository" },
          { text: "08 Roadmap", link: "/concept/08-roadmap" },
          { text: "Decisions", link: "/concept/decisions" },
        ],
      },
      {
        text: "Contributing",
        items: [{ text: "Maintaining the documentation", link: "/contributing/documentation" }],
      },
    ],
    socialLinks: [{ icon: "github", link: REPO }],
    editLink: {
      // Concept pages are copied from docs/. The function runs in the browser — so it must not
      // reference constants of this file.
      pattern: ({ filePath }) =>
        filePath.startsWith("concept/") && filePath !== "concept/index.md"
          ? `https://github.com/dom8509/sysarch/edit/main/docs/${filePath.slice("concept/".length)}`
          : `https://github.com/dom8509/sysarch/edit/main/apps/docs/${filePath}`,
      text: "Edit this page on GitHub",
    },
    search: {
      provider: "local",
      options: {
        translations: {
          button: { buttonText: "Search", buttonAriaLabel: "Search" },
          modal: {
            noResultsText: "No results for",
            resetButtonTitle: "Reset search",
            footer: { selectText: "to select", navigateText: "to navigate", closeText: "to close" },
          },
        },
      },
    },
    footer: { message: "MIT License", copyright: "© Dominik Stamm" },
    outline: { level: [2, 3], label: "On this page" },
    docFooter: { prev: "Previous", next: "Next" },
    lastUpdated: { text: "Last updated" },
    darkModeSwitchLabel: "Appearance",
    lightModeSwitchTitle: "Light",
    darkModeSwitchTitle: "Dark",
    sidebarMenuLabel: "Menu",
    returnToTopLabel: "Return to top",
    langMenuLabel: "Language",
    notFound: { title: "Page not found", quote: "", linkText: "Take me home" },
  },
});
