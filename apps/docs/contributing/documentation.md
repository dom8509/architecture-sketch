# Maintaining the documentation

This page lives in [`apps/docs`](https://github.com/dom8509/sysarch/tree/main/apps/docs) and is
built with [VitePress](https://vitepress.dev). On every push to `main` it is rebuilt together
with the web app and published to GitHub Pages.

## Viewing it locally

```sh
npm install
npm run docs          # development server, http://localhost:5173/sysarch/
npm run docs:build    # docs + web app as on GitHub Pages, into apps/docs/.vitepress/dist
```

## What is written by hand and what is not

| Source | Pages |
|--------|--------|
| **by hand** in `apps/docs/` | home page, getting started, guides, language, diagnostics, CLI options |
| **taken from `docs/`** | all concept pages — only `docs/*.md` is edited |
| **generated from the code** | library, icons, themes, signal kinds, examples, CLI help, all diagram images |

The script `apps/docs/scripts/generate.ts` produces everything in the third row before every
start and build. None of it is checked in.

## ```sysarch blocks

- A block with `architecture "…"` is **rendered** at build time — light and dark, if it sets no
  `theme` — and gets an **Open in the web app** link.
- **Errors and warnings break the build.** An example in the docs therefore cannot go stale
  silently when the language changes.
- Snippets without `architecture` are only highlighted.
- `sysarch code-only` is neither rendered nor checked — for deliberately broken examples.
- Highlighting uses the same lexer as the editor.

## What the tests check

`apps/docs/test/docs.test.ts` runs with `npm test` and therefore in every CI run:

- every diagnostic in the code has a section under [diagnostics](/reference/diagnostics)
- every Obsidian command, setting and menu entry appears in the
  [Obsidian guide](/guides/obsidian)
- every button of the web app appears in the [web app guide](/guides/web-app)
- every CLI option appears in the [CLI reference](/reference/cli)
- every sidebar page exists, and every page appears in the sidebar
- all rendered diagrams are error-free and canonically formatted (`sysarch fmt`)

## Checklist for changes

If a pull request changes something users see — language, library, CLI, web app or Obsidian —
the documentation belongs in the same PR:

- new or changed syntax: [language](/reference/language), the matching guide and `docs/02-dsl.md`
- new diagnostic code: a section under [diagnostics](/reference/diagnostics)
- new theme: a description in `THEME_DESCRIPTIONS` (`scripts/generate.ts`) — otherwise the build breaks
- new category or signal group: a heading in `CATEGORY_TITLES` or `GROUP_TITLES`
- new Obsidian feature, web app button or CLI option: the respective guide
