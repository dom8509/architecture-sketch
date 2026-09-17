# CLI

Anleitung mit Beispielen und GitHub-Actions-Workflow: [CLI und CI](/anleitungen/cli-und-ci).

## Hilfe

Ausgabe von `sysarch --help` — bei jedem Build aus der CLI übernommen:

<!--@include: ../_generated/cli-help.md-->

## Befehle

### `render`

| Option | Bedeutung |
|--------|-----------|
| `--out <verzeichnis>` | schreibt `<name>.<endung>` in das Verzeichnis |
| `--out <datei>` | schreibt genau eine Eingabe in diese Datei; die Endung muss zum Format passen |
| `--out -` | schreibt nach stdout (nicht für PNG) |
| ohne `--out` | schreibt neben die Quelldatei |
| `--format svg\|png\|reactflow` | Endungen `.svg`, `.png`, `.reactflow.json`; Standard `svg` |
| `--scale 1\|2\|3` | nur für PNG, Standard `2` |
| `--theme <name>` | überschreibt das Theme der Quelle |

### `check`

| Option | Bedeutung |
|--------|-----------|
| `--max-warnings <n>` | Exit 1, wenn mehr als `n` Warnungen auftreten |
| `--format text\|json` | Textformat `datei:zeile:spalte: stufe CODE: meldung` oder JSON mit Endposition und Vorschlägen |
| `--verbose` | zeigt im Textformat auch Hinweise (`I…`) |

Prüft `.arch`-Dateien und `.archlib`-Bibliotheken.

### `fmt`

| Option | Bedeutung |
|--------|-----------|
| `--check` | ändert nichts, listet unformatierte Dateien und endet mit Exit 1 |
| `-` als Eingabe | liest von stdin und schreibt nach stdout |

### Allgemein

| Aufruf | Bedeutung |
|--------|-----------|
| `--help`, `-h`, `help` | Hilfe anzeigen |
| `--version`, `-v` | Version ausgeben |

## Eingaben

Eingaben sind Dateien oder Verzeichnisse. Verzeichnisse werden rekursiv nach `.arch` (bei
`check` und `fmt` auch `.archlib`) durchsucht; versteckte Ordner und `node_modules` werden
übersprungen. Shell-Globbing ist deshalb nicht nötig.

## Exit-Codes

| Code | Bedeutung |
|------|-----------|
| `0` | alles in Ordnung |
| `1` | Diagnosen bzw. Prüfung fehlgeschlagen |
| `2` | Aufruf- oder Dateifehler |
