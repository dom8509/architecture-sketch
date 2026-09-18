# External components

An architecture does not end at the circuit board. Motors, valves, connectors, vehicle
buses and test equipment belong in the picture — but they are not part of the system you
are describing. Written as an ordinary `component`, they look like your own scope.
`external` says what they really are.

```sysarch
architecture "Door ECU in its context" {
    direction LR

    external can_body: bus { label "Body CAN" }
    external x1: connector { label "X1" }

    system ecu {
        label "Door ECU"
        component trx: can_transceiver {
            left  { pin can CANH   pin can CANL }
            right { pin digital TXD   pin digital RXD }
        }
        component mcu: microcontroller { label "BCM" }
        component hb: half_bridge
    }

    external window_motor: motor {
        label "Window motor"
        left { pin power A   pin power B }
    }

    can_body -- x1           { label "CAN" type can }
    x1 -- trx.CANH           { type can }
    trx.RXD -> mcu
    mcu -> hb.IN             { label "PWM" type pwm }
    hb.OUT -> window_motor.A { label "Window up/down" }
}
```

`external` stands **in place of** `component` — everything else stays the same: template,
label, pins, `meta`, `count`, `show in`, grid cells and hints all work exactly as they do on
a `component`, and it is allowed everywhere a `component` is: at the top level, in a `zone`,
in a `system`.

## What changes

**The contour is dashed.** Shape, icon and category colour stay as the template defines
them, so the system boundary is readable in the `technical` theme and in a black-and-white
printout as well.

**Unconnected pins stay silent.** An external component is never fully specified — a motor
has two terminals even if your diagram only wires one of them. Pins without a connection
therefore do not report [I301](/reference/diagnostics#i301) here, while they still do on
your own components.

```sysarch
architecture "Only the wired terminal matters" {
    component hb: half_bridge
    external m: motor {
        label "Motor"
        left { pin power A   pin power B }
    }

    hb.OUT -> m.A
}
```

## External and something else at the same time

A vehicle bus is typically both: external **and** a bus. Because `external` is a keyword and
not a category or a shape, the two never collide — take any template from the
[library](/reference/library) and declare it external:

| What | How |
|---|---|
| Vehicle bus | `external can_body: bus` |
| Connector | `external x1: connector` |
| Motor, valve, lamp | `external m: motor`, `external v: valve`, `external l: load` |
| Sensor | `external s: sensor` |
| Supply, ground | `external kl30: battery`, `external gnd: ground` |
| Another ECU | `external tcu: external_ecu` |

A `define` cannot be external: a template describes a building block, not which side of the
system boundary it ends up on. The same motor template serves an in-house motor and a
supplied one.

## Placing them at the edge

External components belong at the edge of the diagram — the context frames the system,
it does not sit in the middle of it. sysarch does not enforce that: place them yourself with
`grid` or `hint` (see [Controlling the layout](./layout)).

```sysarch code-only
layout {
    grid {
        can_body    | x1 | trx | mcu | hb | window_motor
        door_switch | .  | .   | .   | .  | .
    }
}
```

If the document uses zones, an external component lives in a zone like every other one
([E106](/reference/diagnostics#e106)). A context band of its own at the start or the end of
the flow direction is the usual pattern.

## In the exports

The React Flow export carries the flag on the node (`data.external`), the SVG the class
`sa-external` on the component — so your own application can mark the boundary in the same
way.

The complete example is in
[`examples/system-context.arch`](/reference/examples#door-ecu-in-its-context).
