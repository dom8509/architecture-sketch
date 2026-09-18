# 08 — Roadmap

## Milestones for v0.1

Every milestone is usable on its own and ends with green tests.

| # | Milestone | Result | Acceptance |
|---|-------------|----------|---------|
| M0 | Concept | this repository | concept reviewed |
| M1 | Language | `core`: lexer, parser, AST, resolver, diagnostics, `library/automotive.archlib`, icon build for `library/icons/` | all `examples/*.arch` parse without errors; every `E…`/`W…` diagnostic has a test; the parser returns a partial AST for broken input |
| M2 | Layout & SVG | `themes`, `layout` including the five shapes, `render-svg` including icons | golden files for all examples, every shape and every bundled icon in at least one golden file; property tests from [04](04-layout.md#testability) green |
| M3 | CLI | `apps/cli` with `render --format svg`, `check`, `fmt` | CI renders the examples; `fmt` is idempotent |
| M4 | Web app | editor + live preview + diagnostics + SVG export | preview SVG == CLI SVG (byte-identical) |
| M5 | Exports | PNG (browser + CLI), React Flow JSON | the React Flow export loads in a test app with custom nodes |
| M6 | Obsidian | code block rendering, context menu exports, light/dark | released via GitHub; manual test in a vault |
| M7 | Visual editing | selection, properties panel, EditCommands from [06](06-applications.md#visual-editing) | every action produces a minimal text diff; undo works |

## Explicitly not in v0.1

- A freely movable canvas as the primary layout
- Perfect automatic layout
- Views / levels of abstraction
- `use` for external libraries
- Freely drawn shapes, raster images or graphics embedded per diagram
- Plausibility checks
- A VS Code extension
- Collaboration, backend, accounts

## After that

### v0.2 — Reuse and views

- `use "nxp-s32k.archlib"` — project-specific libraries, resolvable relative to the file
  or within the Obsidian vault
- Views:
  ```sysarch
  view overview
  view interface
  view detailed

  component mcu: microcontroller {
      show in overview, interface
      pin spi SPI_CLK { show in detailed }
  }
  ```
  → `architecture-overview.svg`, `architecture-interface.svg`,
  `architecture-detailed.svg` from a single source
- `sysarch render` for Markdown files with several code blocks
- Bus as a shared rail (`component can0: bus`) that several participants attach to
- Icons from project-specific libraries via `use`
- Connections inside `system` blocks

### v0.3 — Engineering semantics

- Building blocks with metadata and interfaces:
  ```sysarch
  define S32K344 extends microcontroller {
      meta { manufacturer "NXP"  family "S32K3"  voltage "3.3 V" }
      interface can CAN0
      interface can CAN1
      interface spi SPI0
  }
  ```
- Plausibility rules, e.g.:
  ```
  E401 mcu.CAN0_TX is connected directly to can_bus.
       Expected: MCU → CAN transceiver → CAN bus
  ```
- Rules declared in libraries themselves (`rule`)
- Export for the requirements/system engineering toolchain (interface list as CSV/JSON)

### Later

- VS Code extension (language server based on `core` + a preview webview)
- Further exports: PDF, PPTX shapes, draw.io
- Themes as a DSL (`theme … { }`), once teams need their own corporate styles
  ([D20](decisions.md))

---

## Open questions

None at the moment. Answered questions are recorded in the
[decisions](decisions.md) D18–D22.
