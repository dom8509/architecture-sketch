# Sprache

Eine Übersicht über alle Konstrukte der Sprache in v0.1. Die vollständige Spezifikation mit
Grammatik und allen Regeln steht in [02 DSL](/konzept/02-dsl).

Dateiendungen: `.arch` für Architekturen, `.archlib` für Bibliotheken. Codeblock-Sprache in
Markdown und Obsidian: `sysarch`.

## Aufbau eines Dokuments

```sysarch nur-code
// Kommentare: // bis Zeilenende oder /* Block */

define <template> [extends <basis>] { … }   // beliebig viele, vor der Architektur

architecture "Titel" {
    theme <name>                 // automotive-light | automotive-dark | presentation | technical
    direction LR                 // LR | TB
    pins all                     // all | connected | none
    stack none                   // none | identical

    layout { … }                 // mode, grid

    zone <id> { … }              // label, system, component
    system <id> { … }            // label, system, component
    component <id>[: <template>] { … }

    <a>[.<PIN>] -> <b>[.<PIN>] { label "…" type <art> }
}
```

## Architektur

| Anweisung | Werte | Standard | Anleitung |
|-----------|-------|----------|-----------|
| `theme` | `automotive-light`, `automotive-dark`, `presentation`, `technical` | `automotive-light` | [Themes](./themes) |
| `direction` | `LR`, `TB` | `LR` | [Layout](/anleitungen/layout#flussrichtung) |
| `pins` | `all`, `connected`, `none` | `all` | [Präsentation](/anleitungen/praesentation#pins-ausblenden) |
| `stack` | `none`, `identical` | `none` | [Präsentation](/anleitungen/praesentation#automatisch-stapeln-mit-stack-identical) |

## Komponente

```sysarch nur-code
component <id>[: <template>] {
    label "Anzeigename"
    size small | medium | large
    importance primary | secondary
    category power | controller | communication | sensor | actuator | software | external | generic
    count 4
    hint row 2
    hint column 3
    meta { voltage "12 V" }

    pin <art> <NAME> ["Label"]
    left { pin … }   right { pin … }   top { pin … }   bottom { pin … }
}
```

- Die ID ist im ganzen Dokument eindeutig. Ohne Template ist der Typ `block`.
- **Label:** Instanz-`label` vor Template-`label` vor ID.
- `size` und `importance` sind die einzigen Stellschrauben für Größe und Gewichtung.
- `meta` wird nicht gezeichnet, aber nach React Flow exportiert (`data.meta`).
- Form und Icon kommen nur aus dem Template — siehe [Eigene Templates](/anleitungen/templates).

## Pins und Signalarten

<!--@include: ../_generated/signalarten.md-->

Seitenwahl, Reihenfolge und Neudeklaration: [Pins und Verbindungen](/anleitungen/pins-und-verbindungen).

## Verbindungen

| Syntax | Bedeutung |
|--------|-----------|
| `a -> b` | gerichtet von `a` nach `b` |
| `a <- b` | gerichtet von `b` nach `a` |
| `a <-> b` | bidirektional |
| `a -- b` | ungerichtet |

Eigenschaften: `label "…"` und `type <art>`. Ohne `type` wird die Art aus den Pins abgeleitet.

## Zonen und Systeme

```sysarch nur-code
zone <id> {
    label "…"
    system <id> { label "…"  component … }
    component …
}
```

Zonen nur auf oberster Ebene; Systeme beliebig verschachtelt. Werden Zonen verwendet, liegt
jede Komponente in einer Zone. Siehe [Zonen und Systeme](/anleitungen/zonen-und-systeme).

## Layout

```sysarch nur-code
layout {
    mode strict | assisted
    grid {
        a | b | c
        . | d | d
    }
}
```

Siehe [Layout steuern](/anleitungen/layout).

## Templates

```sysarch nur-code
define <name> [extends <basis>] {
    label "…"
    category <kategorie>
    size small | medium | large
    shape rounded | rect | circle | hexagon | cylinder
    icon <icon> | none
    pin … / left { … } / right { … } / top { … } / bottom { … }
}
```

Siehe [Eigene Templates](/anleitungen/templates), [Bibliothek](./bibliothek) und [Icons](./icons).

## Reserviert für spätere Versionen

`use "datei.archlib"` · `view <id>` · `show in <view>` · `interface` · `rule` — der Parser meldet
[E110](./diagnosen#e110).
