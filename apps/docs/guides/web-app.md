# Web app

The <a href="/sysarch/app/" target="_blank">web app ↗</a> is editor, preview and export tool in
one. It runs entirely in the browser, without an account and without a server.

## Anatomy

| Area | Contents |
|---------|--------|
| Toolbar | file, examples, theme, exports, sharing, presentation |
| Editor (left) | source text with highlighting, autocompletion and diagnostics in the gutter; resizable and hideable |
| Preview (right) | live diagram; zoom with the scroll wheel, pan by dragging, double-click or **Fit** to fit it in |
| Diagnostics bar (bottom) | errors, warnings and hints; a click jumps to the location |

The divider between editor and preview can be dragged — the width is kept for the next visit.
A double-click on the divider, the **Editor** button in the toolbar or ⌘E / Ctrl+E hides the
editor and gives the diagram the whole width; the same action brings it back at its old width.
With the divider focused, ← and → resize it, Enter hides and shows the editor.

## Writing

- **Autocompletion** suggests template names after `:`, pin names after `component.`, signal
  kinds after `pin` and `type`, and fixed values after `theme`, `size`, `shape` and so on.
- **Diagnostics** appear as you type. On an error, the last valid state stays in the preview
  and is grayed out.
- **Quick fixes**: if a diagnostic carries a suggestion ("did you mean `CAN_TX`?"), you apply
  it in the editor with a click. For an unknown pin
  ([E103](/reference/diagnostics#e103)), the **Create pin `…`** action adds it to the
  component; its kind is derived from the connection.

## Files

| Action | Effect |
|--------|--------|
| **New** | empty architecture as a starting point |
| **Open** (⌘O / Ctrl+O) | load an `.arch` file |
| **Save** (⌘S / Ctrl+S) | save as `.arch`; in Chromium browsers straight back into the opened file |
| **Examples…** | load one of the [examples](/reference/examples) |

The current state is also kept as a **draft** in the browser and restored the next time you
open the app.

## Choosing a view

As soon as the source declares [views](./views), a **View** selector appears next to the
theme. It switches preview and exports to one level of abstraction; **everything** shows the
whole architecture. The selected view ends up in the file name of an export
(`architecture-overview.svg`).

## Choosing a theme

The **Theme** selector overrides the theme for preview and export without changing the source
text. **From source** uses the document's own `theme`. All themes are shown in the
[theme reference](/reference/themes).

## Exporting

| Button | Result |
|--------------|----------|
| **SVG** | standalone SVG file with embedded font |
| **Copy SVG** | SVG source into the clipboard |
| **PNG** | raster image at 1×, 2× or 3× |
| **React Flow** | `.reactflow.json` with nodes, pins and routed edges — see [React Flow](./react-flow) |

Exports are only possible when the source text is free of errors, and they are byte-identical
with the CLI.

## Sharing

**Share link** copies an address whose fragment (`#src=…`) contains the compressed source
text. Whoever opens the link sees exactly your diagram — nothing is stored on a server. Very
large diagrams produce very long links; the web app warns you about that.

Every diagram in this documentation has such a link: **Open in the web app**.

## Presenting

**Present** switches to full screen and shows only the diagram, fitted to the display. `Esc`
leaves the mode. For projectors, the `presentation` theme works well.
