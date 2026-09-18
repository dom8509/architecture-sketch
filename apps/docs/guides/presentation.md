# Presentation views

On slides and in overviews, the message matters, not every single pin. sysarch has four knobs
for that, none of which change the model.

| Statement | Effect |
|-----------|-------------|
| `theme presentation` | larger type, heavier lines, more spacing |
| `pins connected` / `pins none` | draw only connected pins, or none at all |
| `count N` | draw a component as a stack of N identical elements |
| `stack identical` | collapse identically wired components automatically |

## Hiding pins

`pins` lives at the level of the architecture: `all` (the default), `connected` or `none`.
Hidden pins remain addressable — connections then dock onto the body.

```sysarch
architecture "Overview" {
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

## Repeated elements with `count`

`count 4` draws four identical elements as a stack with "×4" next to the label. Pins,
connections and layout stay those of a single component.

```sysarch
architecture "Power Stage" {
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

## Stacking automatically with `stack identical`

Instead of maintaining `count` by hand, `stack identical` collapses identically wired
components: same name stem ("Half Bridge 1" … "Half Bridge 4" → "Half Bridge"), same
template, same group, same pins and same connections. Whole chains collapse together.

```sysarch
architecture "Automatically Stacked" {
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

The model stays complete: `sysarch check` validates every component, and only the layout, the
SVG, the PNG and the React Flow export show the stack.

## Everything together

The [MCU Hub](/reference/examples#mcu-hub) example combines `theme presentation`, `pins none`,
a grid with a spanning MCU, systems and `count`.
