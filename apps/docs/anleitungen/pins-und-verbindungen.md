# Pins und Verbindungen

Pins sind die Schnittstellen einer Komponente. Sie haben eine **Art**, einen **Namen** und
eine **Seite**. Verbindungen laufen zwischen Pins oder direkt zwischen Komponenten.

## Pins deklarieren

```sysarch nur-code
pin <art> <NAME> ["Anzeigelabel"]
```

Pins stehen in der Komponente. Der Name muss pro Komponente eindeutig sein; das optionale
Label ersetzt den Namen in der Darstellung.

```sysarch
architecture "Pins" {
    component mcu: microcontroller {
        label "S32K344"
        pin power VDD
        pin digital CAN0_TX "TX"
        pin digital CAN0_RX "RX"
    }
    component phy: can_transceiver

    mcu.CAN0_TX -> phy.TXD
    phy.RXD -> mcu.CAN0_RX
}
```

Templates bringen eigene Pins mit — `can_transceiver` zum Beispiel `TXD`, `RXD`, `STB`,
`CANH` und `CANL`. Welche das sind, zeigt die [Bibliothek](/referenz/bibliothek).

## Signalarten

Die Art eines Pins bzw. einer Verbindung stammt aus einer festen Liste. Die **Gruppe**
bestimmt die Linienform; so bleibt ein Diagramm auch ohne Farbe lesbar.

<!--@include: ../_generated/signalarten.md-->

## Seiten festlegen

Ohne Angabe wählt sysarch die Seite aus den Verbindungen: Bei `direction LR` wandern Pins mit
überwiegend eingehenden Verbindungen nach links, mit ausgehenden nach rechts. Unverbundene
Pins landen links bzw. oben.

Feste Seiten setzt du mit `left`, `right`, `top` und `bottom`. Die Reihenfolge im Block ist die
Reihenfolge an der Kante.

```sysarch
architecture "Seiten" {
    component mcu: microcontroller {
        label "MCU"
        left   { pin power VDD   pin ground GND }
        right  { pin spi SPI0   pin digital RESET }
        bottom { pin debug JTAG }
    }
    component flash: flash
    component wdg: watchdog
    component dbg { label "Debugger" }

    mcu.SPI0 <-> flash.SPI
    wdg.RESET -> mcu.RESET
    dbg -> mcu.JTAG
}
```

Einen Template-Pin legst du auf eine andere Seite, indem du ihn mit **gleicher Art** neu
deklarierst — etwa `right { pin power VS }` in einer `half_bridge`. Eine andere Art ist ein
Fehler ([E105](/referenz/diagnosen#e105)).

## Verbindungen

| Syntax | Bedeutung |
|--------|-----------|
| `a -> b` | gerichtet von `a` nach `b` |
| `a <- b` | gerichtet von `b` nach `a` |
| `a <-> b` | in beide Richtungen |
| `a -- b` | ungerichtet, ohne Pfeil |

Ein Endpunkt ist eine Komponente (`motor`) oder ein Pin (`mcu.CAN0_TX`). Ohne Pin dockt die
Leitung am Körper an. In geschweiften Klammern setzt du `label` und `type`:

```sysarch
architecture "Verbindungen" {
    component gw: soc { label "Gateway" }
    component bcm: external_ecu { label "BCM" }
    component sensor: sensor { label "Regensensor" }
    component tester: external_ecu { label "Tester" }

    gw <-> bcm   { label "CAN-FD" type can }
    sensor -> gw { label "LIN" type lin }
    tester -- gw { label "DoIP" type diagnostic }
}
```

## Welche Art hat eine Verbindung?

Fehlt `type`, leitet sysarch die Art ab:

1. Beide Endpunkte sind Pins gleicher Art → diese Art.
2. Beide sind Pins verschiedener Arten derselben Gruppe → Art des Quell-Pins.
3. Genau ein Endpunkt ist ein Pin → dessen Art.
4. Sonst `signal`.

Verbindest du Pins aus verschiedenen Gruppen (etwa `power` mit `can`), warnt
[W201](/referenz/diagnosen#w201). Ist das gewollt, setze `type` ausdrücklich.
