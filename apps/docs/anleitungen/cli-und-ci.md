# CLI und CI

Mit der CLI prüfst, formatierst und renderst du Diagramme in Skripten und Pipelines. Die
Ausgabe ist byte-gleich mit Web-App und Obsidian. Installation: [CLI](/einstieg/installation#cli).

In den Beispielen steht `sysarch` für `npm run sysarch --` bzw. `node apps/cli/dist/main.js`.

## Prüfen

```sh
sysarch check architektur/                   # Exit 1 bei Fehlern
sysarch check architektur/ --max-warnings 0  # auch Warnungen brechen
sysarch check architektur/ --verbose         # zusätzlich Hinweise (I…)
sysarch check architektur/ --format json     # maschinenlesbar, inkl. Endposition und Vorschlägen
```

Verzeichnisse werden rekursiv nach `.arch` und `.archlib` durchsucht. Die Meldungen haben das
Compiler-Format `datei:zeile:spalte: stufe CODE: meldung`, das Editoren und CI-Systeme
erkennen.

## Formatieren

```sh
sysarch fmt architektur/          # formatiert in-place
sysarch fmt architektur/ --check  # meldet nur unformatierte Dateien (Exit 1)
sysarch fmt - < door.arch         # stdin → stdout, z. B. für Editor-Integrationen
```

`fmt` erzeugt eine eindeutige Schreibweise: vier Leerzeichen Einrückung, feste Reihenfolge der
Abschnitte, ausgerichtete Einzeiler. Kommentare bleiben erhalten; Dateien mit Syntaxfehlern
werden nicht verändert. Die Regeln stehen in der [Sprachspezifikation](/konzept/02-dsl#_6-kanonische-formatierung).

## Rendern

```sh
sysarch render door.arch                              # door.svg neben der Quelle
sysarch render architektur/ --out build/              # alle Dateien nach build/
sysarch render door.arch --format png --scale 3       # door.png in 3×
sysarch render door.arch --format reactflow --out -   # React-Flow-JSON nach stdout
sysarch render door.arch --theme technical --out door-print.svg
```

Dateien mit Fehlern werden nicht gerendert; der Exit-Code ist dann 1.

## In GitHub Actions

Ein Workflow, der bei jedem Push prüft, ob alle Diagramme gültig und formatiert sind, und die
gerenderten Bilder als Artefakt ablegt:

```yaml
name: Architektur

on: [push, pull_request]

jobs:
  diagrams:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: sysarch bauen
        run: |
          git clone --depth 1 https://github.com/dom8509/sysarch.git "$RUNNER_TEMP/sysarch"
          cd "$RUNNER_TEMP/sysarch" && npm ci && npm run build

      - name: Prüfen und rendern
        run: |
          sysarch() { node "$RUNNER_TEMP/sysarch/apps/cli/dist/main.js" "$@"; }
          sysarch check architektur --max-warnings 0
          sysarch fmt architektur --check
          sysarch render architektur --out build/diagrams
          sysarch render architektur --format png --out build/diagrams

      - uses: actions/upload-artifact@v4
        with:
          name: diagrams
          path: build/diagrams
```

::: tip Diagramme im Repository aktuell halten
Rendert die Pipeline die SVGs und vergleicht sie mit eingecheckten Dateien (`cmp` oder
`git diff --exit-code`), fällt jede vergessene Aktualisierung auf. sysarch selbst prüft so
seine Beispiele gegen `tests/golden/`.
:::

## Exit-Codes

| Code | Bedeutung |
|------|-----------|
| `0` | alles in Ordnung |
| `1` | Diagnosen bzw. Prüfung fehlgeschlagen |
| `2` | Aufruf- oder Dateifehler |
