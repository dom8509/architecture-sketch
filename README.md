# sysarch — Architecture-as-Code für Engineering-Diagramme

> Konsistente technische Architekturdiagramme aus Text: feste Semantik, feste Abstände,
> Pins als First-Class-Elemente, orthogonale Verbindungen, Corporate Styles und
> reproduzierbare SVG-/PNG-Ausgabe.

**Status:** In Entwicklung. Umgesetzt sind M1 (Sprache: [`packages/core`](packages/core)),
M2 (Layout & SVG: [`packages/themes`](packages/themes), [`packages/layout`](packages/layout),
[`packages/render-svg`](packages/render-svg)), M3 (CLI: [`apps/cli`](apps/cli)), M4
(Web-App: [`packages/editor`](packages/editor), [`apps/web`](apps/web)) und M5 (Exporte:
[`packages/export-png`](packages/export-png), [`packages/export-reactflow`](packages/export-reactflow),
Test-App [`apps/reactflow-test`](apps/reactflow-test)). Obsidian folgt.

```sh
npm install
npm run typecheck
npm test                  # inkl. Golden Files unter tests/golden/
npx vitest run -u         # Golden Files nach einer gewollten Layoutänderung aktualisieren
npm run build             # CLI, Web-App und React-Flow-Test-App bauen
npm run web               # Web-App mit Live-Vorschau unter http://localhost:5173
npm run reactflow-test    # React-Flow-Test-App: lädt Beispiele bzw. exportiertes JSON

npm run sysarch -- render examples --out build/examples
npm run sysarch -- render examples --format png --scale 2 --out build/examples
npm run sysarch -- render examples --format reactflow --out build/examples
npm run sysarch -- check examples library --max-warnings 0
npm run sysarch -- fmt examples library --check
```

## Positionierung

| Tool       | optimiert auf                          |
|------------|----------------------------------------|
| Excalidraw | Freiheit                               |
| Mermaid    | schnelle, generische Diagramme         |
| React Flow | interaktive Graph-Anwendungen          |
| **sysarch**| **konsistente Embedded-/Systemarchitekturen** |

Die Einschränkungen sind der Vorteil: Zehn Diagramme von zehn Entwicklern sehen aus,
als hätte sie eine Person erstellt.

## Grundprinzipien

1. **Der Text ist das führende Modell.** SVG, PNG und React-Flow-JSON werden daraus
   erzeugt. Visuelles Editieren ändert den Text, nie einen parallelen State.
2. **Ein einziges Layoutmodell.** Vorschau und Export kommen aus demselben Scene Graph —
   was im Editor zu sehen ist, wird exportiert.
3. **Design-System statt Pixel.** Keine Koordinaten, keine freien Schriftgrößen. Nur
   semantische Stufen (`size`, `importance`, `category`); das Theme entscheidet.
4. **Deterministisch.** Gleiche Eingabe ergibt byte-gleiches SVG — im Browser, in
   Obsidian und in der CI.
5. **Core ohne Laufzeit-Abhängigkeiten.** Lexer, Parser, Layout, Routing und
   SVG-Renderer sind eigener TypeScript-Code.

## Kurzbeispiel

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

## Konzept

| Dokument | Inhalt |
|----------|--------|
| [01 Zielbild](docs/01-zielbild.md) | Produkt, Zielgruppen, Einsatzorte, Abgrenzung |
| [02 DSL v0.1](docs/02-dsl.md) | Sprache, Grammatik, Diagnosen |
| [03 Domänenmodell](docs/03-domaenenmodell.md) | AST, Semantic Model, Scene Graph als TypeScript |
| [04 Layout & Routing](docs/04-layout.md) | Platzierung, Zonen, Grid, orthogonales Routing |
| [05 Rendering & Export](docs/05-rendering-export.md) | Themes, SVG, PNG, React Flow |
| [06 Anwendungen](docs/06-anwendungen.md) | Web-App, Obsidian, CLI, visuelles Editieren |
| [07 Repository-Struktur](docs/07-repository.md) | Pakete, Abhängigkeitsregeln, Tooling |
| [08 Roadmap](docs/08-roadmap.md) | Meilensteine, MVP-Schnitt, offene Fragen |
| [Entscheidungen](docs/entscheidungen.md) | Festgelegte Designentscheidungen mit Begründung |

Beispiele liegen unter [`examples/`](examples/).

## Lizenz

[MIT](LICENSE)
