# Controlling the layout

sysarch places and routes automatically. When the result does not fit, you give
**declarative** hints — never pixels or coordinates.

## Flow direction

`direction LR` (the default) arranges the signal flow from left to right, `direction TB` from
top to bottom. This affects the order of the zones and the sides of derived pins.

```sysarch
architecture "Supply Chain" {
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

## Grid: fixing rows and columns

`layout { grid { … } }` defines which row and column a component occupies in the finished
picture — independently of `direction`. Rows are separated by line breaks, columns by `|`,
and `.` is an empty cell. Components that are not listed are placed by the layout itself.

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

## Spanning cells

If the same ID appears in several adjacent cells, the component occupies all of them and is
stretched to their combined width or height. The cells have to form a gap-free rectangle
([E107](/reference/diagnostics#e107)). Pin-less connections to components above and below
then run straight.

```sysarch
architecture "Central Building Block" {
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

## Hints for individual components

`hint row N` and `hint column N` (1-based) place a single component without writing out a
whole grid. Hints only take effect with `mode assisted`; in `mode strict` (the default) they
are ignored and reported as [W202](/reference/diagnostics#w202).

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

## Zones stay contiguous

Grid and hints must not tear zones apart: all components of one zone have to come before
those of the next zone. Otherwise sysarch reports
[E108](/reference/diagnostics#e108).

::: tip How the layout computes
Placement, pin docking and the orthogonal routing are described in the concept page
[04 Layout & Routing](/concept/04-layout).
:::
