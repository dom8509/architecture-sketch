# 07 — Repository structure

## Target structure

```
sysarch/
├─ docs/                      concept (this directory)
├─ library/
│  ├─ automotive.archlib      standard templates, written in the DSL itself
│  └─ icons/                  single-colour 24×24 SVGs, cleaned into IconDef at build time
├─ examples/                  example architectures, also the golden file inputs
│
├─ packages/
│  ├─ core/                   @sysarch/core
│  │  ├─ lexer/
│  │  ├─ parser/              error-tolerant recursive descent parser
│  │  ├─ ast/                 lossless syntax tree
│  │  ├─ resolve/             templates, pins, type inference → semantic model
│  │  ├─ diagnostics/         codes, messages, suggestions
│  │  ├─ format/              canonical formatter
│  │  └─ edit/                TextEdit, quick fixes; EditCommand → TextEdit[] (M7)
│  │
│  ├─ themes/                 @sysarch/themes — design tokens + font metrics
│  │
│  ├─ layout/                 @sysarch/layout
│  │  ├─ rank.ts
│  │  ├─ zones.ts
│  │  ├─ order.ts
│  │  ├─ shapes.ts            inner area, hull, contour per shape
│  │  ├─ size.ts
│  │  ├─ place.ts
│  │  ├─ route.ts
│  │  └─ labels.ts
│  │
│  ├─ render-svg/             @sysarch/render-svg — SceneGraph → SVG string
│  ├─ export-png/             @sysarch/export-png — browser rasterising
│  ├─ export-reactflow/       @sysarch/export-reactflow — JSON, no React dependency
│  └─ editor/                 @sysarch/editor — framework-free editor (DOM + CodeMirror 6)
│
├─ apps/
│  ├─ web/                    Vite, static site
│  ├─ reactflow-test/         test app for the React Flow export (React, only here)
│  ├─ obsidian/               Obsidian plugin (esbuild)
│  ├─ docs/                   user documentation (VitePress, GitHub Pages)
│  └─ cli/                    Node CLI
│
└─ tests/
   └─ golden/                 expected scene graph JSON and SVGs for examples/
```

## Dependency rules

```
core  ←  layout  ←  render-svg  ←  export-png
  ↑        ↑            ↑
themes ────┴────────────┤ (render-svg: font outlines for the subset)
  ↑                     │
export-reactflow ───────┘ (types from core/layout only)

editor  → core, layout, themes, render-svg, export-*  (+ CodeMirror 6)
apps/*  → any package
```

| Package | Runtime dependencies | Environment |
|-------|-------------------------|----------|
| `core`, `themes`, `layout`, `render-svg`, `export-reactflow` | **none** | anywhere (no DOM, no Node API) |
| `export-png` | none | browser (DOM, canvas) |
| `editor` | CodeMirror 6 | browser |
| `apps/web` | Vite (build only) | browser |
| `apps/reactflow-test` | React, `@xyflow/react` | browser (test app only, not shipped) |
| `apps/obsidian` | `obsidian` (API types) | Obsidian |
| `apps/cli` | `@resvg/resvg-js` (from M5, PNG) | Node |
| `apps/docs` | VitePress, markdown-it (build only) | static site |

Forbidden across the whole repository: Mermaid, Graphviz, Dagre, ELK.js, Konva, Fabric.js,
JointJS, GoJS, React Flow as a runtime dependency of a package (the test app
`apps/reactflow-test` is exempt — it plays the target application).

The rules are enforced by lint (import restrictions per package), not by convention alone.

## Tooling

| Area | Choice | Rationale |
|---------|------|------------|
| Language | TypeScript, `strict`, ES2022 modules | Obsidian plugins are TypeScript |
| Package management | npm workspaces | no extra tool needed |
| Build | TypeScript project references (including the CLI, as long as it only runs inside the monorepo); esbuild for Obsidian and for a published CLI bundle; Vite for the web | fast, little configuration |
| Tests | Vitest | snapshot/golden file tests built in |
| Lint/format | oxlint + Prettier (TS only, not the DSL) | fast |
| Runtime | Node ≥ 22 LTS | |
| CI | GitHub Actions: `check`, `test`, golden file diff, build of all apps | |
| Documentation | VitePress in `apps/docs`; the `docs.yml` workflow publishes the docs and the web app to GitHub Pages on every push to `main` | reference parts and diagrams are generated from the code at build time |
| Release | Obsidian plugin via GitHub release (`main.js`, `manifest.json`, `styles.css`); the `obsidian-release.yml` workflow runs on a tag matching the version in `apps/obsidian/manifest.json` | Obsidian community format |

## Conventions

- The public API of a package is exposed exclusively through `src/index.ts`.
- Pure functions in the core; no classes with mutable state outside `editor`.
- No `Map`/`Set` iteration without a defined order in layout and rendering.
- Every new diagnostic gets a code, documentation in `02-dsl.md` and in
  `apps/docs/reference/diagnostics.md`, plus a test.
- User-facing changes (language, library, CLI, web app, Obsidian) update the documentation
  in `apps/docs` in the same pull request — see
  `apps/docs/contributing/documentation.md`.
- Every layout change updates the golden files in the same commit.
- Icon cleanup (`scripts/build-icons`) runs in the build and in CI; an invalid icon breaks
  the build.
