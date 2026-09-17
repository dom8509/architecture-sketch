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

/** ```sysarch: Highlighting wie im Editor, bei `architecture "…"` darüber das gerenderte Diagramm. */
function sysarchBlocks(md: MarkdownIt) {
  const fallback = md.renderer.rules.fence!;
  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx]!;
    const [lang, ...flags] = token.info.trim().split(/\s+/);
    if (lang !== "sysarch") return fallback(tokens, idx, options, env, self);
    // bei jedem Aufruf neu lesen: `npm run generate` im laufenden `vitepress dev`
    const manifest: Record<string, Block> = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};
    const block = manifest[blockKey(token.content)];
    if (!block) {
      const message = `sysarch-Block nicht generiert (${env.relativePath}) — \`npm run generate -w @sysarch/docs\` ausführen`;
      if (building) throw new Error(message);
      console.warn(message);
    }
    const code =
      `<div class="language-sysarch vp-adaptive-theme"><button title="Code kopieren" class="copy"></button>` +
      `<span class="lang">sysarch</span><pre class="vp-code"><code>${block?.html ?? escapeHtml(token.content)}</code></pre></div>`;
    if (!block?.light || flags.includes("nur-code")) return code;
    const img = (src: string, cls: string) => `<img class="${cls}" src="${src}" alt="Diagramm" loading="lazy">`;
    return (
      `<div class="sysarch-example"><figure class="sysarch-figure">` +
      (block.dark ? img(block.light, "sa-light") + img(block.dark, "sa-dark") : img(block.light, "")) +
      `<figcaption><a href="${BASE}app/${block.share}" target="_blank" rel="noopener">In der Web-App öffnen ↗</a></figcaption>` +
      `</figure>${code}</div>`
    );
  };
}

export default defineConfig({
  lang: "de-DE",
  title: "sysarch",
  description: "Architecture-as-Code für Embedded- und Systemarchitekturen",
  base: BASE,
  cleanUrls: true,
  lastUpdated: true,
  srcExclude: ["_generated/**", "README.md"],
  // die Web-App liegt neben der Doku unter /app/ und ist keine VitePress-Seite
  ignoreDeadLinks: [/^\/app\//],
  head: [["link", { rel: "icon", href: `${BASE}logo.svg` }]],

  markdown: { config: sysarchBlocks },

  themeConfig: {
    logo: "/logo.svg",
    nav: [
      { text: "Schnellstart", link: "/einstieg/schnellstart" },
      { text: "Anleitungen", link: "/anleitungen/" },
      { text: "Referenz", link: "/referenz/sprache" },
      { text: "Konzept", link: "/konzept/" },
      { text: "Web-App", link: `${BASE}app/`, target: "_blank" },
    ],
    sidebar: [
      {
        text: "Einstieg",
        items: [
          { text: "Was ist sysarch?", link: "/einstieg/" },
          { text: "Schnellstart", link: "/einstieg/schnellstart" },
          { text: "Installation", link: "/einstieg/installation" },
        ],
      },
      {
        text: "Anleitungen",
        items: [
          { text: "Übersicht", link: "/anleitungen/" },
          { text: "Pins und Verbindungen", link: "/anleitungen/pins-und-verbindungen" },
          { text: "Zonen und Systeme", link: "/anleitungen/zonen-und-systeme" },
          { text: "Layout steuern", link: "/anleitungen/layout" },
          { text: "Präsentationssichten", link: "/anleitungen/praesentation" },
          { text: "Eigene Templates", link: "/anleitungen/templates" },
          { text: "Web-App", link: "/anleitungen/web-app" },
          { text: "Obsidian", link: "/anleitungen/obsidian" },
          { text: "CLI und CI", link: "/anleitungen/cli-und-ci" },
          { text: "Nach React Flow exportieren", link: "/anleitungen/react-flow" },
        ],
      },
      {
        text: "Referenz",
        items: [
          { text: "Sprache", link: "/referenz/sprache" },
          { text: "Bibliothek", link: "/referenz/bibliothek" },
          { text: "Icons", link: "/referenz/icons" },
          { text: "Themes", link: "/referenz/themes" },
          { text: "Diagnosen", link: "/referenz/diagnosen" },
          { text: "CLI", link: "/referenz/cli" },
          { text: "Beispiele", link: "/referenz/beispiele" },
        ],
      },
      {
        text: "Konzept",
        collapsed: true,
        items: [
          { text: "Übersicht", link: "/konzept/" },
          { text: "01 Zielbild", link: "/konzept/01-zielbild" },
          { text: "02 DSL", link: "/konzept/02-dsl" },
          { text: "03 Domänenmodell", link: "/konzept/03-domaenenmodell" },
          { text: "04 Layout & Routing", link: "/konzept/04-layout" },
          { text: "05 Rendering & Export", link: "/konzept/05-rendering-export" },
          { text: "06 Anwendungen", link: "/konzept/06-anwendungen" },
          { text: "07 Repository", link: "/konzept/07-repository" },
          { text: "08 Roadmap", link: "/konzept/08-roadmap" },
          { text: "Entscheidungen", link: "/konzept/entscheidungen" },
        ],
      },
      {
        text: "Mitwirken",
        items: [{ text: "Dokumentation pflegen", link: "/mitwirken/dokumentation" }],
      },
    ],
    socialLinks: [{ icon: "github", link: REPO }],
    editLink: {
      // Konzeptseiten werden aus docs/ übernommen. Die Funktion läuft im Browser — daher ohne
      // Verweise auf Konstanten dieser Datei.
      pattern: ({ filePath }) =>
        filePath.startsWith("konzept/") && filePath !== "konzept/index.md"
          ? `https://github.com/dom8509/sysarch/edit/main/docs/${filePath.slice("konzept/".length)}`
          : `https://github.com/dom8509/sysarch/edit/main/apps/docs/${filePath}`,
      text: "Diese Seite auf GitHub bearbeiten",
    },
    search: {
      provider: "local",
      options: {
        translations: {
          button: { buttonText: "Suchen", buttonAriaLabel: "Suchen" },
          modal: {
            noResultsText: "Keine Ergebnisse für",
            resetButtonTitle: "Suche zurücksetzen",
            footer: { selectText: "auswählen", navigateText: "navigieren", closeText: "schließen" },
          },
        },
      },
    },
    footer: { message: "MIT-Lizenz", copyright: "© Dominik Stamm" },
    outline: { level: [2, 3], label: "Auf dieser Seite" },
    docFooter: { prev: "Zurück", next: "Weiter" },
    lastUpdated: { text: "Zuletzt geändert" },
    darkModeSwitchLabel: "Darstellung",
    lightModeSwitchTitle: "Hell",
    darkModeSwitchTitle: "Dunkel",
    sidebarMenuLabel: "Menü",
    returnToTopLabel: "Nach oben",
    langMenuLabel: "Sprache",
    notFound: { title: "Seite nicht gefunden", quote: "", linkText: "Zur Startseite" },
  },
});
