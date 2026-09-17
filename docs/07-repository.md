# 07 — Repository-Struktur

## Zielstruktur

```
sysarch/
├─ docs/                      Konzept (dieses Verzeichnis)
├─ library/
│  ├─ automotive.archlib      Standard-Templates, in der DSL selbst geschrieben
│  └─ icons/                  einfarbige 24×24-SVGs, zur Build-Zeit zu IconDef bereinigt
├─ examples/                  Beispielarchitekturen, zugleich Golden-File-Eingaben
│
├─ packages/
│  ├─ core/                   @sysarch/core
│  │  ├─ lexer/
│  │  ├─ parser/              fehlertoleranter Recursive-Descent-Parser
│  │  ├─ ast/                 verlustfreier Syntaxbaum
│  │  ├─ resolve/             Templates, Pins, Typableitung → Semantic Model
│  │  ├─ diagnostics/         Codes, Meldungen, Vorschläge
│  │  ├─ format/              kanonischer Formatter
│  │  └─ edit/                TextEdit, Quick-Fixes; EditCommand → TextEdit[] (M7)
│  │
│  ├─ themes/                 @sysarch/themes — Design-Tokens + Font-Metriken
│  │
│  ├─ layout/                 @sysarch/layout
│  │  ├─ rank.ts
│  │  ├─ zones.ts
│  │  ├─ order.ts
│  │  ├─ shapes.ts            Innenbereich, Hülle, Kontur je Form
│  │  ├─ size.ts
│  │  ├─ place.ts
│  │  ├─ route.ts
│  │  └─ labels.ts
│  │
│  ├─ render-svg/             @sysarch/render-svg — SceneGraph → SVG-String
│  ├─ export-png/             @sysarch/export-png — Browser-Rasterisierung
│  ├─ export-reactflow/       @sysarch/export-reactflow — JSON, ohne React-Abhängigkeit
│  └─ editor/                 @sysarch/editor — framework-freier Editor (DOM + CodeMirror 6)
│
├─ apps/
│  ├─ web/                    Vite, statische Seite
│  ├─ reactflow-test/         Test-App für den React-Flow-Export (React, nur hier)
│  ├─ obsidian/               Obsidian-Plugin (esbuild)
│  ├─ docs/                   Nutzerdokumentation (VitePress, GitHub Pages)
│  └─ cli/                    Node-CLI
│
└─ tests/
   └─ golden/                 erwartete SceneGraph-JSON und SVGs zu examples/
```

## Abhängigkeitsregeln

```
core  ←  layout  ←  render-svg  ←  export-png
  ↑        ↑            ↑
themes ────┴────────────┤ (render-svg: Schriftkonturen für das Subset)
  ↑                     │
export-reactflow ───────┘ (nur Typen aus core/layout)

editor  → core, layout, themes, render-svg, export-*  (+ CodeMirror 6)
apps/*  → beliebige packages
```

| Paket | Laufzeit-Abhängigkeiten | Umgebung |
|-------|-------------------------|----------|
| `core`, `themes`, `layout`, `render-svg`, `export-reactflow` | **keine** | überall (kein DOM, kein Node-API) |
| `export-png` | keine | Browser (DOM, Canvas) |
| `editor` | CodeMirror 6 | Browser |
| `apps/web` | Vite (nur Build) | Browser |
| `apps/reactflow-test` | React, `@xyflow/react` | Browser (nur Test-App, nicht ausgeliefert) |
| `apps/obsidian` | `obsidian` (API-Typen) | Obsidian |
| `apps/cli` | `@resvg/resvg-js` (ab M5, PNG) | Node |
| `apps/docs` | VitePress, markdown-it (nur Build) | statische Seite |

Verboten im gesamten Repo: Mermaid, Graphviz, Dagre, ELK.js, Konva, Fabric.js,
JointJS, GoJS, React Flow als Laufzeitabhängigkeit eines Pakets (die Test-App
`apps/reactflow-test` ist davon ausgenommen — sie spielt die Zielanwendung).

Die Regeln werden per Lint geprüft (Import-Beschränkungen je Paket), nicht nur per
Konvention.

## Tooling

| Bereich | Wahl | Begründung |
|---------|------|------------|
| Sprache | TypeScript, `strict`, ES2022-Module | Obsidian-Plugins sind TypeScript |
| Paketverwaltung | npm Workspaces | kein zusätzliches Werkzeug nötig |
| Build | TypeScript Project References (auch CLI, solange sie nur im Monorepo läuft); esbuild für Obsidian und ein veröffentlichtes CLI-Bundle; Vite für Web | schnell, wenig Konfiguration |
| Tests | Vitest | Snapshot-/Golden-File-Tests eingebaut |
| Lint/Format | oxlint + Prettier (nur TS, nicht DSL) | schnell |
| Laufzeit | Node ≥ 22 LTS | |
| CI | GitHub Actions: `check`, `test`, Golden-File-Diff, Build aller Apps | |
| Dokumentation | VitePress in `apps/docs`; Workflow `docs.yml` veröffentlicht Doku und Web-App bei jedem Push auf `main` auf GitHub Pages | Referenzteile und Diagramme werden beim Build aus dem Code erzeugt |
| Release | Obsidian-Plugin über GitHub Release (`main.js`, `manifest.json`, `styles.css`); Workflow `obsidian-release.yml` bei Tag = Version aus `apps/obsidian/manifest.json` | Obsidian-Community-Format |

## Konventionen

- Öffentliche API je Paket ausschließlich über `src/index.ts`.
- Reine Funktionen im Core; keine Klassen mit veränderlichem Zustand außerhalb von `editor`.
- Keine `Map`/`Set`-Iteration ohne definierte Reihenfolge in Layout und Rendering.
- Jede neue Diagnose bekommt Code, Dokumentation in `02-dsl.md` und in
  `apps/docs/referenz/diagnosen.md` sowie einen Test.
- Nutzerseitige Änderungen (Sprache, Bibliothek, CLI, Web-App, Obsidian) aktualisieren die
  Dokumentation in `apps/docs` im selben Pull Request — siehe
  `apps/docs/mitwirken/dokumentation.md`.
- Jede Layout-Änderung aktualisiert die Golden Files im selben Commit.
- Icon-Bereinigung (`scripts/build-icons`) läuft im Build und in der CI; ein ungültiges
  Icon bricht den Build.
