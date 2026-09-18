# Zones and systems

Both group components, but they serve different purposes:

| | `zone` | `system` |
|---|---|---|
| Purpose | **layout** band along the flow direction | **semantic** boundary: ECU, domain, vehicle |
| Nesting | top level only | anywhere, including inside zones |
| Rendering | labeled band with a subtle background | labeled frame |

## Zones: the signal flow as bands

Zones appear in the order in which they are written — with `direction LR` as columns from
left to right, with `direction TB` as rows from top to bottom.

```sysarch
architecture "Signal Chain" {
    direction LR

    zone input {
        label "Sensing"
        component temp: sensor { label "Temperature" }
        component pos: sensor { label "Position" }
    }

    zone processing {
        label "Processing"
        component mcu: microcontroller
    }

    zone output {
        label "Actuation"
        component heater: load { label "Heater" }
        component motor: motor
    }

    temp -> mcu   { type analog }
    pos -> mcu    { type digital }
    mcu -> heater { type pwm }
    mcu -> motor  { type pwm }
}
```

::: warning All or nothing
Once you use zones, **every** component has to live in a zone. Otherwise sysarch reports
[E106](/reference/diagnostics#e106).
:::

## Systems: showing boundaries

A `system` frames what belongs together — independently of the layout. Systems can be nested
and may live inside zones.

```sysarch
architecture "Vehicle Network" {
    direction LR

    system vehicle {
        label "Vehicle"
        system bcm {
            label "Body Control Module"
            component mcu: microcontroller { label "RH850" }
            component can: can_transceiver
        }
        component door: external_ecu { label "Door ECU" }
    }
    component cloud: external_ecu { label "Backend" }

    mcu -> can.TXD
    can.CANH <-> door { type can }
    door -> cloud     { label "Telematics" type ethernet }
}
```

The structure is always a tree: `architecture › zone › system … › component`. A component
belongs to the innermost block it is written in, and its ID is unique across the whole
document. Connections always live at the level of the `architecture`.
