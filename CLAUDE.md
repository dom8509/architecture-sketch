# sysarch

Architecture-as-Code for embedded and system architectures. npm workspaces monorepo
(`packages/*`, `apps/*`). Language of documentation, comments and commits: English.

## Commands

- `npm run typecheck`, `npm test` — before every commit
- `npm run docs:build` — build documentation + web app; fails on broken diagrams in the docs and on dead links
- `npm run docs` — docs with live reload

## Keeping the documentation up to date

The user documentation (`apps/docs`, VitePress) is published to GitHub Pages on every push
to `main` (`.github/workflows/docs.yml`).

- Every user-facing change — syntax, library, diagnostics, CLI, web app, Obsidian plugin — updates `apps/docs` **in the same PR**: the reference (`reference/`) and the matching guide (`guides/`); syntax and rule changes additionally `docs/02-dsl.md`.
- `docs/*.md` (concept) is copied to `apps/docs/concept/` at build time — only edit it in `docs/`.
- Library, icons, themes, signal kinds, examples, CLI help and all diagram images are generated from the code by `apps/docs/scripts/generate.ts`; new themes, categories or signal groups need a text there.
- ```` ```sysarch ```` blocks containing `architecture "…"` are rendered and must be error-free, warning-free and formatted with `sysarch fmt`; deliberately broken examples use ```` ```sysarch code-only ````.
- `apps/docs/test/docs.test.ts` checks diagnostic codes, Obsidian commands/settings/menus, web-app buttons, CLI options and the sidebar against the code.
