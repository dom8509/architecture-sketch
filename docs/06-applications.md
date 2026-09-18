# 06 — Applications

All applications are thin shells around the same core. No application contains parse,
layout or render logic of its own.

```
               @sysarch/core  →  layout  →  render-svg / export-*
                         ▲
                 @sysarch/editor   (framework-free: DOM + CodeMirror 6)
                  ▲          ▲
            apps/web    apps/obsidian            apps/cli (without editor)
```

---

## Web app

```
┌───────────────────────┬──────────────────────────────┬──────────────────┐
│ DSL editor            │ Preview (inline SVG)         │ Properties       │
│ CodeMirror 6          │ zoom/pan, click = select     │ of the selection │
│ Highlighting,         │                              │                  │
│ autocomplete for      │                              │                  │
│ templates/pins/kinds  │                              │                  │
├───────────────────────┴──────────────────────────────┴──────────────────┤
│ Diagnostics (click jumps to the line)                                   │
│ Theme ▾ │ Export: SVG · PNG 2× · React Flow · Copy SVG │ Presentation   │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Export:** SVG and Copy SVG (last valid state), PNG at 1×/2×/3× via
  `@sysarch/export-png`, React Flow JSON via `@sysarch/export-reactflow` (only for
  error-free source, with the selected theme).
- **Live preview** on every change (debounced 150 ms). Preview and export use the same
  call as the CLI (`renderArchitecture` from `render-svg`); a test checks for all examples
  and themes that the SVG is byte-identical. Zoom with the mouse wheel, pan by dragging,
  double-click fits the diagram. On errors, the last valid state stays on screen and
  diagnostics appear in the editor and in the bar.
- **Highlighting** via the lexer from `core` (no second grammar).
- **Autocomplete** from the semantic model: template names after `:`, pin names after
  `component.`, signal kinds after `pin` and `type`, fixed values after `theme`, `size`
  and so on.
- **Quick fixes** on diagnostics: suggestions ("did you mean …?") as a replacement, for
  `E103` additionally "Create pin" ([D18](decisions.md)) — `codeActions` in `core/edit`
  produces `TextEdit`s; the signal kind comes from the connection's `type`, otherwise from
  the pin on the other side, otherwise `signal`. The side is derived by the resolver.
- **Diagnostics bar:** errors and warnings; hints (`I…`) only on request, as in the CLI.
- **Bidirectional selection** (M7): the cursor inside a component highlights it in the
  preview; a click in the preview moves the cursor to the definition (via `origin` spans).
- **Saving:** v0.1 locally (File System Access API or download/upload) and `localStorage`
  as a draft. No backend.
- **Sharing:** the DSL compressed into the URL fragment (`#src=…`) so that links work
  without a server.
- **Presentation mode:** full screen, preview only, `fit to screen`, theme switchable
  (e.g. `presentation` without changing the source).

## Obsidian plugin

A code block processor for the language `sysarch`:

````markdown
```sysarch
architecture "Door ECU" {
    component mcu: microcontroller { label "S32K3" }
    …
}
```
````

- Rendering via `registerMarkdownCodeBlockProcessor("sysarch", …)` as inline SVG (with a
  prefix per diagram, [D23](decisions.md)); the width adapts to the note.
- **Theme:** if the code block sets no `theme`, the diagram follows the Obsidian mode
  (`automotive-light` / `automotive-dark`) and switches along with it. An explicit `theme`
  takes precedence.
- **Context menu on the diagram:**
  - Edit source (switches to edit mode, cursor into the code block)
  - Open in editor (a modal with editor, preview and diagnostics — writes back into
    exactly that code block on close, located via `getSectionInfo`; if the block has
    changed in the meantime, nothing is overwritten and the source goes to the clipboard).
    Properties and visual editing follow with M7.
  - Export SVG / Export PNG / Export React Flow JSON — stored in the note's attachment
    folder or in the configured export folder; the file name comes from the title
    (`"Door ECU"` → `door-ecu.svg`), and a repeated export overwrites the file so that
    embeds stay current
  - Copy SVG
- Diagnostics (errors, warnings) appear below the diagram, not as a modal; a click jumps
  to the spot in the code block.
- A dedicated view for `.arch` files (the same editor as in the web app), with exports in
  the view's "More options" menu.
- **Library** in the right sidebar (command "Show library" or the ribbon icon): all
  templates of the standard library by category, each with a preview in the current theme,
  label, base template and pins; the search field filters by name, label, icon and pins. A
  click inserts `component <name>: <template>` at the cursor position of the most recently
  active note or `.arch` file (with no editor: the clipboard); context menu "Copy".
- Commands: "Insert code block", "New .arch file", "Show library".
- Plugin settings: default theme ("Follow Obsidian" or a fixed theme), PNG scale, export
  folder (empty = attachment folder).
- **Installation:** released via GitHub (`main.js`, `manifest.json`, `styles.css`),
  triggered by a tag carrying the plugin version (`0.1.0`); locally
  `npm run obsidian:install -- <vault>`. For BRAT, a copy of
  `apps/obsidian/manifest.json` sits in the repository root (a test keeps both in sync);
  BRAT then installs the files from the release for that version.

## CLI

```sh
sysarch render examples/zonal-ecu.arch --format svg --out build/
sysarch render examples/*.arch --format png --scale 2 --out build/
sysarch render examples/zonal-ecu.arch --format reactflow --out build/zonal-ecu.reactflow.json
sysarch render docs/architecture.md --out build/      # renders all sysarch code blocks (v0.2)

sysarch check  examples/*.arch                        # exit 1 on errors
sysarch check  examples/*.arch --max-warnings 0       # warnings break the build too
sysarch fmt    examples/*.arch                        # formats in place
sysarch fmt    examples/*.arch --check                # check only (CI)
```

- Diagnostics in compiler format `file:line:column: error E103: …` so that editors and CI
  annotations recognise them; `check --format json` for machine readability (including the
  end position and suggestions). Hints (`I…`) appear in the text format only with
  `--verbose`.
- Inputs are files or directories (searched recursively for `.arch`, and for `check`/`fmt`
  also `.archlib`) so that invocations without shell globbing (Windows, npm scripts) work.
- `render`: without `--out` next to the source, `--out <directory>`,
  `--out file.svg|.png|.reactflow.json` (exactly one input) or `--out -` (stdout, not for
  PNG); `--theme` overrides the theme of the source. Files with errors are not rendered.
- `--format svg|png|reactflow` with the extensions `.svg`, `.png`, `.reactflow.json`;
  `--scale 1|2|3` only for PNG (default 2).
- `fmt -` reads from stdin and writes to stdout (for editor integrations).
- Exit codes: `0` ok, `1` diagnostics or check failed, `2` invocation or file error.
- The output is byte-identical to the web app — verified by golden file tests; CI compares
  the examples rendered by the CLI against `tests/golden/`.

---

## Visual editing

Visual changes produce **text changes**, not a separate state:

```
 click/drag in the preview
        │
        ▼
 EditCommand            e.g. { type: "setLabel", component: "mcu", value: "S32K3" }
        │  commandToEdits(tree, command)
        ▼
 TextEdit[]             [{ start, end: <label string of mcu>, newText: "\"S32K3\"" }]
        │  apply to the source text
        ▼
 new source text  →  parse → resolve → layout → render
```

- Because the AST is lossless, comments, order and formatting of the file are preserved.
  Only the affected spots change — the git diff of a visual change is as small as that of
  a hand edit.
- Every visual change is one undo step in the text editor.

**Commands in v0.1:**

| Action in the preview | EditCommand | Effect on the text |
|------------------------|-------------|--------------------|
| Change the label in the properties field | `setLabel` | replace or insert `label "…"` |
| Choose category/size/importance | `setProperty` | replace/insert a line |
| Add a pin (+ Add Pin) | `addPin` | `pin <kind> <NAME>` in the matching side block |
| Drag a pin to another side | `movePin` | move the pin into another side block |
| Reorder pins via ☰ | `reorderPin` | swap lines |
| Drag a pin onto a pin | `addConnection` | `a.X -> b.Y` at the end of the connections |
| Rename a component (ID) | `renameComponent` | the definition and **all** references |
| Move a component (only `mode assisted`) | `setHint` | set `hint row/column` |
| Remove | `remove` | delete the definition and all its connections |

Properties panel for a component:

```
Component
────────────────────
ID        mcu
Type      microcontroller
Label     S32K3
Category  controller ▾
Size      medium ▾
Pins
  ☰ CAN_TX    can     right
  ☰ CAN_RX    can     right
  + Add Pin
```
