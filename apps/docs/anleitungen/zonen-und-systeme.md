# Zonen und Systeme

Beide gruppieren Komponenten, haben aber verschiedene Aufgaben:

| | `zone` | `system` |
|---|---|---|
| Zweck | **Layout**-Band entlang der Flussrichtung | **inhaltliche** Grenze: Steuergerät, Domäne, Fahrzeug |
| Verschachtelung | nur auf oberster Ebene | beliebig, auch innerhalb von Zonen |
| Darstellung | beschriftetes Band mit dezentem Hintergrund | beschrifteter Rahmen |

## Zonen: der Signalfluss als Bänder

Zonen erscheinen in der Reihenfolge, in der sie im Text stehen — bei `direction LR` als
Spalten von links nach rechts, bei `direction TB` als Zeilen von oben nach unten.

```sysarch
architecture "Signalkette" {
    direction LR

    zone input {
        label "Erfassung"
        component temp: sensor { label "Temperatur" }
        component pos: sensor { label "Position" }
    }

    zone processing {
        label "Verarbeitung"
        component mcu: microcontroller
    }

    zone output {
        label "Ansteuerung"
        component heater: load { label "Heizung" }
        component motor: motor
    }

    temp -> mcu   { type analog }
    pos -> mcu    { type digital }
    mcu -> heater { type pwm }
    mcu -> motor  { type pwm }
}
```

::: warning Alles oder nichts
Verwendest du Zonen, muss **jede** Komponente in einer Zone liegen. Sonst meldet sysarch
[E106](/referenz/diagnosen#e106).
:::

## Systeme: Grenzen zeigen

Ein `system` umrahmt, was zusammengehört — unabhängig vom Layout. Systeme lassen sich
verschachteln und dürfen in Zonen liegen.

```sysarch
architecture "Fahrzeugverbund" {
    direction LR

    system vehicle {
        label "Fahrzeug"
        system bcm {
            label "Body Control Module"
            component mcu: microcontroller { label "RH850" }
            component can: can_transceiver
        }
        component door: external_ecu { label "Türsteuergerät" }
    }
    component cloud: external_ecu { label "Backend" }

    mcu -> can.TXD
    can.CANH <-> door { type can }
    door -> cloud     { label "Telematik" type ethernet }
}
```

Die Struktur ist immer ein Baum: `architecture › zone › system … › component`. Eine
Komponente gehört dem innersten Block, in dem sie steht, und ihre ID ist im ganzen Dokument
eindeutig. Verbindungen stehen immer auf Ebene der `architecture`.
