# sysarch — Architecture-as-Code for engineering diagrams

> Consistent technical architecture diagrams from text: fixed semantics, fixed spacing,
> pins as first-class elements, orthogonal connections, corporate styles and reproducible
> SVG/PNG output.

**Documentation:** https://dom8509.github.io/sysarch/ · **Web app:** https://dom8509.github.io/sysarch/app/

**Status:** In development. Implemented so far are M1 (language: [`packages/core`](packages/core)),
M2 (layout & SVG: [`packages/themes`](packages/themes), [`packages/layout`](packages/layout),
[`packages/render-svg`](packages/render-svg)), M3 (CLI: [`apps/cli`](apps/cli)), M4
(web app: [`packages/editor`](packages/editor), [`apps/web`](apps/web)), M5 (exports:
[`packages/export-png`](packages/export-png), [`packages/export-reactflow`](packages/export-reactflow),
test app [`apps/reactflow-test`](apps/reactflow-test)) and M6 (Obsidian plugin:
[`apps/obsidian`](apps/obsidian)).

```sh
npm install
npm run typecheck
npm test                  # including golden files under tests/golden/
npx vitest run -u         # update golden files after an intended layout change
npm run build             # build CLI, web app, React Flow test app and Obsidian plugin
npm run web               # web app with live preview at http://localhost:5173
npm run reactflow-test    # React Flow test app: loads examples or exported JSON
npm run obsidian:install -- ~/path/to/vault   # build the Obsidian plugin and copy it into a vault
npm run docs              # documentation with live reload at http://localhost:5173/sysarch/
npm run docs:build        # build documentation + web app exactly as on GitHub Pages

npm run sysarch -- render examples --out build/examples
npm run sysarch -- render examples --format png --scale 2 --out build/examples
npm run sysarch -- render examples --format reactflow --out build/examples
npm run sysarch -- check examples library --max-warnings 0
npm run sysarch -- fmt examples library --check
```

## Positioning

| Tool       | optimized for                                 |
|------------|-----------------------------------------------|
| Excalidraw | freedom                                       |
| Mermaid    | quick, generic diagrams                       |
| React Flow | interactive graph applications                |
| **sysarch**| **consistent embedded/system architectures**  |

The constraints are the point: ten diagrams from ten engineers look as though one person
drew them all.

## Core principles

1. **The text is the source of truth.** SVG, PNG and React Flow JSON are derived from it.
   Visual editing changes the text, never a parallel state.
2. **A single layout model.** Preview and export come from the same scene graph — what you
   see in the editor is what gets exported.
3. **Design system instead of pixels.** No coordinates, no free-form font sizes. Only
   semantic steps (`size`, `importance`, `category`); the theme decides.
4. **Deterministic.** The same input yields byte-identical SVG — in the browser, in
   Obsidian and in CI.
5. **Core without runtime dependencies.** Lexer, parser, layout, routing and the SVG
   renderer are our own TypeScript code.

## Short example

```sysarch
architecture "Door ECU" {
    theme automotive-light
    direction LR

    component mcu: microcontroller {
        label "S32K3"
        pin digital PWM
    }
    component driver: half_bridge {
        label "Door Motor Driver"
    }
    component motor: motor {
        label "Window Motor"
    }

    mcu.PWM -> driver.IN {
        label "PWM"
        type digital
    }
    driver.OUT -> motor {
        label "12 V PWM"
        type power
    }
}
```

## Concept

| Document | Contents |
|----------|----------|
| [01 Vision](docs/01-vision.md) | Product, audiences, use sites, scope boundaries |
| [02 DSL v0.1](docs/02-dsl.md) | Language, grammar, diagnostics |
| [03 Domain model](docs/03-domain-model.md) | AST, semantic model, scene graph as TypeScript |
| [04 Layout & routing](docs/04-layout.md) | Placement, zones, grid, orthogonal routing |
| [05 Rendering & export](docs/05-rendering-export.md) | Themes, SVG, PNG, React Flow |
| [06 Applications](docs/06-applications.md) | Web app, Obsidian, CLI, visual editing |
| [07 Repository structure](docs/07-repository.md) | Packages, dependency rules, tooling |
| [08 Roadmap](docs/08-roadmap.md) | Milestones, MVP scope, open questions |
| [Decisions](docs/decisions.md) | Settled design decisions with their rationale |

Examples live under [`examples/`](examples/).

## License

[MIT](LICENSE)
