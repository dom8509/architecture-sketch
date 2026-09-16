# 08 — Roadmap

## Meilensteine v0.1

Jeder Meilenstein ist für sich nutzbar und endet mit grünen Tests.

| # | Meilenstein | Ergebnis | Abnahme |
|---|-------------|----------|---------|
| M0 | Konzept | dieses Repository | Konzept reviewt |
| M1 | Sprache | `core`: Lexer, Parser, AST, Resolver, Diagnosen, `library/automotive.archlib`, Icon-Build für `library/icons/` | alle `examples/*.arch` parsen fehlerfrei; jede Diagnose `E…`/`W…` hat einen Test; Parser liefert bei kaputtem Input ein Teil-AST |
| M2 | Layout & SVG | `themes`, `layout` inkl. fünf Formen, `render-svg` inkl. Icons | Golden Files für alle Beispiele, jede Form und jedes mitgelieferte Icon in mindestens einem Golden File; Eigenschaftstests aus [04](04-layout.md#testbarkeit) grün |
| M3 | CLI | `apps/cli` mit `render --format svg`, `check`, `fmt` | CI rendert Beispiele; `fmt` ist idempotent |
| M4 | Web-App | Editor + Live-Vorschau + Diagnosen + SVG-Export | Vorschau-SVG == CLI-SVG (byte-gleich) |
| M5 | Exporte | PNG (Browser + CLI), React Flow JSON | React-Flow-Export lädt in einer Test-App mit Custom Nodes |
| M6 | Obsidian | Codeblock-Rendering, Kontextmenü-Exporte, Hell/Dunkel | Release über GitHub; manueller Test im Vault |
| M7 | Visuelles Editieren | Auswahl, Eigenschaftenpanel, EditCommands aus [06](06-anwendungen.md#visuelles-editieren) | jede Aktion erzeugt minimalen Text-Diff; Undo funktioniert |

## Ausdrücklich nicht in v0.1

- Frei verschiebbarer Canvas als primäres Layout
- Perfektes automatisches Layout
- Views / Abstraktionsebenen
- `use` externer Bibliotheken
- Frei gezeichnete Formen, Raster-Bilder oder pro Diagramm eingebettete Grafiken
- Plausibilitätsprüfungen
- VS-Code-Extension
- Kollaboration, Backend, Accounts

## Danach

### v0.2 — Wiederverwendung und Sichten

- `use "nxp-s32k.archlib"` — projektspezifische Bibliotheken, auflösbar relativ zur
  Datei bzw. im Obsidian-Vault
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
  → `architecture-overview.svg`, `architecture-interface.svg`, `architecture-detailed.svg`
  aus einer Quelle
- `sysarch render` für Markdown-Dateien mit mehreren Codeblöcken
- Bus als Sammelschiene (`component can0: bus`), an die mehrere Teilnehmer andocken
- Icons aus projektspezifischen Bibliotheken per `use`
- Verbindungen innerhalb von `system`-Blöcken

### v0.3 — Engineering-Semantik

- Bausteine mit Metadaten und Schnittstellen:
  ```sysarch
  define S32K344 extends microcontroller {
      meta { manufacturer "NXP"  family "S32K3"  voltage "3.3 V" }
      interface can CAN0
      interface can CAN1
      interface spi SPI0
  }
  ```
- Plausibilitätsregeln, z. B.:
  ```
  E401 mcu.CAN0_TX ist direkt mit can_bus verbunden.
       Erwartet: MCU → CAN-Transceiver → CAN-Bus
  ```
- Regeln selbst deklarativ in Bibliotheken (`rule`)
- Export für Requirements-/System-Engineering-Toolchain (Schnittstellenliste als CSV/JSON)

### Später

- VS-Code-Extension (Language Server auf Basis von `core` + Vorschau-Webview)
- Weitere Exporte: PDF, PPTX-Shapes, draw.io

---

## Offene Fragen

| Frage | Tendenz |
|-------|---------|
| Sollen unbekannte Pins (`mcu.PWM` ohne Deklaration) im Skizzen-Modus automatisch angelegt werden? | v0.1 strikt (`E103` mit Vorschlag); Quick-Fix „Pin anlegen“ im Editor als Komfort |
| Schrift: Inter fest, oder Corporate-Schrift pro Theme? | Inter fest in v0.1; Font-Metriken-Generator so bauen, dass weitere Schriften möglich sind |
| Themes auch als DSL (`theme … { }`) statt TypeScript? | erst, wenn Teams eigene Corporate Styles brauchen (v0.2+) |
| Name des Produkts: `sysarch` bleibt, Repository heißt weiter `architecture-sketch`? | Ja, bis zur ersten öffentlichen Veröffentlichung |
| Lizenz | offen |
