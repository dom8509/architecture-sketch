# Pins and connections

Pins are the interfaces of a component. They have a **kind**, a **name** and a **side**.
Connections run between pins or directly between components.

## Declaring pins

```sysarch code-only
pin <kind> <NAME> ["display label"]
```

Pins live inside the component. The name has to be unique per component; the optional label
replaces the name in the rendering.

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

Templates bring their own pins — `can_transceiver`, for instance, has `TXD`, `RXD`, `STB`,
`CANH` and `CANL`. Which ones these are is shown in the [library](/reference/library).

## Signal kinds

The kind of a pin or a connection comes from a fixed list. The **group** determines the line
style, so a diagram stays readable even without color.

<!--@include: ../_generated/signal-kinds.md-->

## Fixing sides

Without an explicit side, sysarch derives it from the connections: with `direction LR`, pins
with mostly incoming connections move to the left, those with outgoing ones to the right.
Unconnected pins end up on the left or on the top.

Fixed sides are set with `left`, `right`, `top` and `bottom`. The order inside the block is
the order along the edge.

```sysarch
architecture "Sides" {
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

You move a template pin to a different side by redeclaring it with the **same kind** — for
example `right { pin power VS }` in a `half_bridge`. A different kind is an error
([E105](/reference/diagnostics#e105)).

## Connections

| Syntax | Meaning |
|--------|-----------|
| `a -> b` | directed from `a` to `b` |
| `a <- b` | directed from `b` to `a` |
| `a <-> b` | in both directions |
| `a -- b` | undirected, without an arrow |

An endpoint is either a component (`motor`) or a pin (`mcu.CAN0_TX`). Without a pin, the line
docks onto the body. In curly braces you set `label` and `type`:

```sysarch
architecture "Connections" {
    component gw: soc { label "Gateway" }
    component bcm: external_ecu { label "BCM" }
    component sensor: sensor { label "Rain Sensor" }
    component tester: external_ecu { label "Tester" }

    gw <-> bcm   { label "CAN-FD" type can }
    sensor -> gw { label "LIN" type lin }
    tester -- gw { label "DoIP" type diagnostic }
}
```

## Which kind does a connection have?

If `type` is missing, sysarch derives the kind:

1. Both endpoints are pins of the same kind → that kind.
2. Both are pins of different kinds within the same group → the kind of the source pin.
3. Exactly one endpoint is a pin → that pin's kind.
4. Otherwise `signal`.

If you connect pins from different groups (say `power` with `can`),
[W201](/reference/diagnostics#w201) warns about it. If that is intentional, set `type`
explicitly.
