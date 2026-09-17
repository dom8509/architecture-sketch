# 06 — Anwendungen

Alle Anwendungen sind dünne Hüllen um denselben Core. Keine Anwendung enthält eigene
Parse-, Layout- oder Render-Logik.

```
               @sysarch/core  →  layout  →  render-svg / export-*
                         ▲
                 @sysarch/editor   (framework-frei: DOM + CodeMirror 6)
                  ▲          ▲
            apps/web    apps/obsidian            apps/cli (ohne editor)
```

---

## Web-App

```
┌───────────────────────┬──────────────────────────────┬─────────────┐
│ DSL-Editor            │ Vorschau (inline SVG)         │ Eigenschaften│
│ CodeMirror 6          │ Zoom/Pan, Klick = Auswahl     │ der Auswahl │
│ Highlighting,         │                               │             │
│ Autocomplete für      │                               │             │
│ Templates/Pins/Arten  │                               │             │
├───────────────────────┴──────────────────────────────┴─────────────┤
│ Diagnosen (Klick springt zur Zeile)                                 │
│ Theme ▾ │ Export: SVG · PNG 2× · React Flow · SVG kopieren │ Präsentation │
└─────────────────────────────────────────────────────────────────────┘
```

- **Live-Vorschau** bei jeder Änderung (debounced 150 ms). Vorschau und Export nutzen
  denselben Aufruf wie die CLI (`renderArchitecture` aus `render-svg`); ein Test prüft für
  alle Beispiele und Themes, dass das SVG byte-gleich ist. Zoom per Mausrad, Pan per
  Ziehen, Doppelklick passt ein. Bei Fehlern bleibt der letzte
  gültige Stand stehen, Diagnosen erscheinen im Editor und in der Leiste.
- **Highlighting** über den Lexer aus `core` (keine zweite Grammatik).
- **Autocomplete** aus dem Semantic Model: Template-Namen nach `:`, Pin-Namen nach
  `komponente.`, Signalarten nach `pin` und `type`, feste Werte nach `theme`, `size` usw.
- **Quick-Fixes** an Diagnosen: Vorschläge („meintest du …?“) als Ersetzung, bei `E103`
  zusätzlich „Pin anlegen“ ([D18](entscheidungen.md)) — `codeActions` in `core/edit` erzeugt
  `TextEdit`s; die Signalart kommt aus `type` der Verbindung, sonst vom Pin der Gegenseite,
  sonst `signal`. Die Seite leitet der Resolver ab.
- **Diagnosenleiste:** Fehler und Warnungen; Hinweise (`I…`) wie in der CLI nur auf Wunsch.
- **Bidirektionale Auswahl** (M7): Cursor in einer Komponente markiert sie in der Vorschau;
  Klick in der Vorschau setzt den Cursor auf die Definition (über `origin`-Spans).
- **Speichern:** v0.1 lokal (File System Access API bzw. Download/Upload) und
  `localStorage` als Entwurf. Kein Backend.
- **Teilen:** DSL komprimiert im URL-Fragment (`#src=…`), damit Links ohne Server
  funktionieren.
- **Präsentationsmodus:** Vollbild, nur Vorschau, `fit to screen`, Theme wechselbar
  (z. B. `presentation` ohne die Quelle zu ändern).

## Obsidian-Plugin

Codeblock-Prozessor für die Sprache `sysarch`:

````markdown
```sysarch
architecture "Door ECU" {
    component mcu: microcontroller { label "S32K3" }
    …
}
```
````

- Rendering über `registerMarkdownCodeBlockProcessor("sysarch", …)` als inline SVG.
- **Theme:** Setzt der Codeblock kein `theme`, folgt das Diagramm dem Obsidian-Modus
  (`automotive-light` / `automotive-dark`). Ein explizites `theme` hat Vorrang.
- **Kontextmenü am Diagramm:**
  - Quelle bearbeiten (springt in den Codeblock)
  - Visuellen Editor öffnen (Modal mit Editor, Vorschau, Eigenschaften — schreibt beim
    Schließen in genau diesen Codeblock zurück, ermittelt über `getSectionInfo`)
  - PNG exportieren / SVG exportieren (Ablage im Anhangsordner des Vaults)
  - SVG kopieren
  - React Flow JSON exportieren
- Diagnosen erscheinen unter dem Diagramm, nicht als Modal.
- Zusätzlich eigener View für `.arch`-Dateien (gleicher Editor wie in der Web-App).
- Plugin-Einstellungen: Standard-Theme hell/dunkel, PNG-Skalierung, Exportordner.

## CLI

```sh
sysarch render examples/zonal-ecu.arch --format svg --out build/
sysarch render examples/*.arch --format png --scale 2 --out build/
sysarch render examples/zonal-ecu.arch --format reactflow --out build/zonal-ecu.json
sysarch render docs/architektur.md --out build/      # rendert alle sysarch-Codeblöcke (v0.2)

sysarch check  examples/*.arch                        # Exit 1 bei Fehlern
sysarch check  examples/*.arch --max-warnings 0       # auch Warnungen brechen
sysarch fmt    examples/*.arch                        # formatiert in-place
sysarch fmt    examples/*.arch --check                # nur prüfen (CI)
```

- Diagnosen im Compiler-Format `datei:zeile:spalte: error E103: …`, damit Editoren und
  CI-Annotationen sie erkennen; `check --format json` für Maschinenlesbarkeit (inkl.
  Endposition und Vorschlägen). Hinweise (`I…`) erscheinen im Textformat nur mit `--verbose`.
- Eingaben sind Dateien oder Verzeichnisse (rekursiv nach `.arch`, bei `check`/`fmt` auch
  `.archlib`), damit Aufrufe ohne Shell-Globbing (Windows, npm-Skripte) funktionieren.
- `render`: ohne `--out` neben die Quelle, `--out <verzeichnis>`, `--out datei.svg` (genau
  eine Eingabe) oder `--out -` (stdout); `--theme` überschreibt das Theme der Quelle.
  Dateien mit Fehlern werden nicht gerendert.
- `fmt -` liest von stdin und schreibt nach stdout (für Editor-Integrationen).
- Exit-Codes: `0` ok, `1` Diagnosen bzw. Prüfung fehlgeschlagen, `2` Aufruf- oder Dateifehler.
- Ausgabe ist byte-identisch zur Web-App — geprüft über Golden-File-Tests; die CI vergleicht
  die von der CLI gerenderten Beispiele mit `tests/golden/`.

---

## Visuelles Editieren

Visuelle Änderungen erzeugen **Textänderungen**, keinen eigenen State:

```
 Klick/Drag in Vorschau
        │
        ▼
 EditCommand            z. B. { type: "setLabel", component: "mcu", value: "S32K3" }
        │  commandToEdits(tree, command)
        ▼
 TextEdit[]             [{ start, end: <label-String von mcu>, newText: "\"S32K3\"" }]
        │  auf Quelltext anwenden
        ▼
 neuer Quelltext  →  parse → resolve → layout → render
```

- Weil der AST verlustfrei ist, bleiben Kommentare, Reihenfolge und Formatierung der
  Datei erhalten. Nur die betroffenen Stellen ändern sich — der Git-Diff einer
  visuellen Änderung ist so klein wie bei einer Handänderung.
- Jede visuelle Änderung ist ein Undo-Schritt im Texteditor.

**Befehle v0.1:**

| Aktion in der Vorschau | EditCommand | Textwirkung |
|------------------------|-------------|-------------|
| Label im Eigenschaftenfeld ändern | `setLabel` | `label "…"` ersetzen oder einfügen |
| Kategorie/Größe/Wichtigkeit wählen | `setProperty` | Zeile ersetzen/einfügen |
| Pin hinzufügen (+ Add Pin) | `addPin` | `pin <art> <NAME>` im passenden Seitenblock |
| Pin per Drag auf andere Seite | `movePin` | Pin in anderen Seitenblock verschieben |
| Pin-Reihenfolge per ☰ | `reorderPin` | Zeilen tauschen |
| Pin auf Pin ziehen | `addConnection` | `a.X -> b.Y` am Ende der Verbindungen |
| Komponente umbenennen (ID) | `renameComponent` | Definition und **alle** Referenzen |
| Komponente verschieben (nur `mode assisted`) | `setHint` | `hint row/column` setzen |
| Entfernen | `remove` | Definition samt aller Verbindungen löschen |

Eigenschaftenpanel für eine Komponente:

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
