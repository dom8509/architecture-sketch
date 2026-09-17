# Präsentationssichten

Für Folien und Übersichten zählt die Aussage, nicht jeder Pin. sysarch hat dafür vier
Stellschrauben, die das Modell unverändert lassen.

| Anweisung | Wirkung |
|-----------|---------|
| `theme presentation` | größere Schrift, kräftigere Linien, mehr Abstand |
| `pins connected` / `pins none` | nur verbundene bzw. gar keine Pins zeichnen |
| `count N` | eine Komponente als Stapel von N gleichen Elementen zeichnen |
| `stack identical` | gleich verschaltete Komponenten automatisch zusammenfassen |

## Pins ausblenden

`pins` steht auf Ebene der Architektur: `all` (Standard), `connected` oder `none`.
Ausgeblendete Pins bleiben adressierbar — Verbindungen docken dann am Körper an.

```sysarch
architecture "Übersicht" {
    theme presentation
    pins connected

    component sbc: power_supply { label "SBC" }
    component mcu: microcontroller {
        label "S32K344"
        pin power VDD
    }
    component can: can_transceiver

    sbc.VOUT -> mcu.VDD { label "3.3 V" }
    mcu <-> can.CANH    { type can }
}
```

## Mehrfachelemente mit `count`

`count 4` zeichnet vier gleiche Elemente als Stapel mit „×4“ neben dem Label. Pins,
Verbindungen und Layout bleiben die einer einzelnen Komponente.

```sysarch
architecture "Leistungsstufe" {
    pins none

    component mcu: microcontroller
    component hb: half_bridge {
        label "Half Bridge"
        count 4
    }
    component motor: motor { count 4 }

    mcu -> hb   { type pwm }
    hb -> motor { type power }
}
```

## Automatisch stapeln mit `stack identical`

Statt `count` von Hand zu pflegen, fasst `stack identical` gleich verschaltete Komponenten
zusammen: gleicher Namensstamm („Half Bridge 1“ … „Half Bridge 4“ → „Half Bridge“), gleiches
Template, gleiche Gruppe, gleiche Pins und gleiche Verbindungen. Ketten fassen sich mit
zusammen.

```sysarch
architecture "Automatisch gestapelt" {
    pins none
    stack identical

    component mcu: microcontroller
    component hb1: half_bridge { label "Half Bridge 1" }
    component hb2: half_bridge { label "Half Bridge 2" }
    component hb3: half_bridge { label "Half Bridge 3" }
    component m1: motor { label "Motor 1" }
    component m2: motor { label "Motor 2" }
    component m3: motor { label "Motor 3" }

    mcu -> hb1 { type pwm }
    mcu -> hb2 { type pwm }
    mcu -> hb3 { type pwm }
    hb1 -> m1  { type power }
    hb2 -> m2  { type power }
    hb3 -> m3  { type power }
}
```

Das Modell bleibt vollständig: `sysarch check` prüft alle Komponenten, nur Layout, SVG, PNG und
React-Flow-Export zeigen den Stapel.

## Alles zusammen

Das Beispiel [MCU Hub](/referenz/beispiele#mcu-hub) kombiniert `theme presentation`,
`pins none`, ein Grid mit überspannender MCU, Systeme und `count`.
