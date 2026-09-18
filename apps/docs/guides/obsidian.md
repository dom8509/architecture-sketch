# Obsidian

The plugin renders sysarch inside notes, opens `.arch` files in the editor of the web app and
shows the library in the sidebar. For installation, see
[Installation](/getting-started/installation#obsidian-plugin).

## Diagrams in notes

Write a code block with the language `sysarch`:

````md
```sysarch
architecture "Door ECU" {
    component mcu: microcontroller { label "S32K3" }
    component driver: half_bridge
    mcu -> driver.IN
}
```
````

In reading mode and in live preview, the diagram appears, sized to the width of the note.
Errors and warnings are listed below it; a click jumps to the spot in the code block.

The command **sysarch: Insert code block** inserts the scaffolding together with a small
starter template.

### Light and dark

If the code block sets no `theme`, the diagram follows the Obsidian mode
(`automotive-light` or `automotive-dark`) and switches along with it. A `theme` in the code
block takes precedence. This behavior is controlled by the **Default theme** setting.

### Views

If the source declares [views](./views), a selector appears above the diagram — in a code
block as well as in the `.arch` editor and in the editor window. It switches the diagram to
one level of abstraction; **everything** shows the whole architecture. Exports follow the
selection and carry the view in their file name (`door-ecu-overview.svg`).

### Context menu on a diagram

| Entry | Effect |
|---------|--------|
| **Edit source** | switches to editing mode with the cursor in the code block |
| **Open in editor** | window with editor, preview and diagnostics; **Apply** writes back into exactly this code block, **Discard** does not |
| **Export SVG** | SVG file in the export folder |
| **Export PNG** | PNG at the configured scale |
| **Copy SVG** | SVG source into the clipboard |
| **Export React Flow JSON** | `.reactflow.json` in the export folder |

The file name comes from the title (`"Door ECU"` → `door-ecu.svg`), plus the selected view
(`door-ecu-overview.svg`). Exporting again overwrites
the file, so that embedded images (`![[door-ecu.svg]]`) stay up to date.

::: tip Code block changed in the meantime?
If the code block changed while the editor window was open, the plugin overwrites nothing. The
new source then ends up in the clipboard.
:::

## `.arch` files

Files with the extension `.arch` are opened by Obsidian in the same editor as the web app:
source text, live preview and diagnostics side by side. The exports live in the view's
**More options** (⋯) menu.

The divider between editor and preview can be dragged; a double-click on it or
**sysarch: Toggle editor pane** hides the editor so that the diagram gets the whole width.
With the divider focused, ← and → resize it, Enter hides and shows the editor. Width and
visibility are remembered and apply to every `.arch` file that is opened afterwards.

A new file is created by **sysarch: New .arch file**.

## Library in the sidebar

**sysarch: Show library** — or the library icon in the left ribbon — opens all templates of
the standard library in the right sidebar:

- grouped by category, with a preview in the current theme, label, base template and pins
- the search box filters by name, label, icon and pin name (`CANH` finds `can_transceiver`)
- a **click** inserts `component <name>: <template>` at the cursor position of the most
  recently active note or `.arch` file; with no editor open, the line goes to the clipboard
- the context menu offers **Insert** and **Copy**

The same templates, with their definitions, are described in the
[library reference](/reference/library).

## Commands

| Command | Effect |
|--------|--------|
| **Insert code block** | ` ```sysarch ` block with a starter template at the cursor position |
| **New .arch file** | creates `Architecture.arch` in the folder for new files and opens it |
| **Show library** | opens the library in the sidebar |
| **Toggle editor pane** | hides or shows the editor of the active `.arch` view |

## Settings

| Setting | Meaning |
|-------------|-----------|
| **Default theme** | theme for diagrams without a `theme`; **Follow Obsidian** picks light or dark to match the current mode |
| **PNG scale** | resolution of the PNG export: 1×, 2× or 3× |
| **Export folder** | folder in the vault for SVG, PNG and React Flow JSON; empty = the attachment folder from the Obsidian settings |
