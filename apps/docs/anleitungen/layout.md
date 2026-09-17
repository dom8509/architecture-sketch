# Layout steuern

sysarch platziert und routet automatisch. Wenn das Ergebnis nicht passt, gibst du
**deklarative** Vorgaben — nie Pixel oder Koordinaten.

## Flussrichtung

`direction LR` (Standard) ordnet den Signalfluss von links nach rechts, `direction TB` von
oben nach unten. Das betrifft die Reihenfolge der Zonen und die Seiten abgeleiteter Pins.

```sysarch
architecture "Versorgungskette" {
    direction TB

    component kl30: battery { label "KL30" }
    component fuse: fuse { label "F12" }
    component ldo: ldo
    component mcu: microcontroller

    kl30 -> fuse.IN
    fuse.OUT -> ldo.VIN
    ldo.VOUT -> mcu { label "5 V" }
}
```

## Grid: Zeilen und Spalten vorgeben

`layout { grid { … } }` legt fest, in welcher Zeile und Spalte eine Komponente im fertigen
Bild steht — unabhängig von `direction`. Zeilen trennst du mit Zeilenumbrüchen, Spalten mit
`|`, und `.` ist eine leere Zelle. Nicht aufgeführte Komponenten platziert das Layout selbst.

```sysarch
architecture "Grid" {
    layout {
        grid {
            battery | regulator | mcu
            .       | wdg       | hb
        }
    }

    component battery: battery
    component regulator: power_supply
    component mcu: microcontroller
    component wdg: watchdog
    component hb: half_bridge

    battery -> regulator.VIN
    regulator.VOUT -> mcu
    mcu -> wdg.WDI
    mcu -> hb.IN
}
```

## Zellen überspannen

Steht dieselbe ID in mehreren benachbarten Zellen, belegt die Komponente alle und wird auf
deren Breite bzw. Höhe gestreckt. Die Zellen müssen ein lückenloses Rechteck bilden
([E107](/referenz/diagnosen#e107)). Verbindungen ohne Pin zu Komponenten darüber und darunter
laufen dann gerade.

```sysarch
architecture "Zentraler Baustein" {
    pins none

    layout {
        grid {
            .   | can | eth | lin
            sbc | mcu | mcu | mcu
        }
    }

    component sbc: power_supply { label "SBC" }
    component mcu: microcontroller { label "S32K344" }
    component can: can_transceiver
    component eth: ethernet_phy
    component lin: lin_transceiver

    sbc -> mcu  { type power }
    mcu <-> can { type can }
    mcu <-> eth { type ethernet }
    mcu <-> lin { type lin }
}
```

## Hints für einzelne Komponenten

`hint row N` und `hint column N` (1-basiert) platzieren eine einzelne Komponente, ohne ein
ganzes Grid zu schreiben. Hints wirken nur mit `mode assisted`; in `mode strict` (Standard)
werden sie ignoriert und mit [W202](/referenz/diagnosen#w202) gemeldet.

```sysarch
architecture "Hints" {
    layout {
        mode assisted
    }

    component mcu: microcontroller
    component wdg: watchdog { hint row 2 }
    component flash: flash

    mcu -> wdg.WDI
    mcu <-> flash.SPI
}
```

## Zonen bleiben zusammenhängend

Grid und Hints dürfen Zonen nicht auseinanderreißen: Alle Komponenten einer Zone müssen vor
denen der nächsten Zone liegen. Sonst meldet sysarch [E108](/referenz/diagnosen#e108).

::: tip Wie das Layout rechnet
Platzierung, Pin-Andockung und das orthogonale Routing beschreibt das Konzept
[04 Layout & Routing](/konzept/04-layout).
:::
