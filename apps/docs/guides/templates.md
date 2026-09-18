# Custom templates

A template defines what a kind of component looks like: label, category, size, shape, icon and
pins. The [library](/reference/library) ships the common building blocks; you define your own
with `define` **before** the `architecture`.

## Creating a template

```sysarch
define sbc {
    label "System Basis Chip"
    category power
    size medium
    icon regulator
    left   { pin power VBAT   pin digital WAKE }
    right  { pin power VCC   pin can CANH   pin can CANL }
    bottom { pin digital RESET }
}

architecture "Custom Template" {
    component kl30: battery { label "KL30" }
    component sbc: sbc { label "FS26" }
    component mcu: microcontroller

    kl30 -> sbc.VBAT
    sbc.VCC -> mcu   { label "5 V" }
    sbc.RESET -> mcu { label "Reset" }
}
```

| Property | Values |
|-------------|-------|
| `label` | default label of every instance |
| `category` | `power`, `controller`, `communication`, `sensor`, `actuator`, `software`, `external`, `generic` — picks the color family |
| `size` | `small`, `medium`, `large` |
| `shape` | `rounded` (default), `rect`, `circle`, `hexagon`, `cylinder` |
| `icon` | a name from the [icons](/reference/icons); `icon none` removes an inherited icon |
| `pin`, `left`/`right`/`top`/`bottom` | pins, just like in a component |

Templates describe **no geometry** — dimensions and colors always come from the theme.

## Deriving a template

`extends` takes everything from the base template. Pins are appended, all other settings are
overridden.

```sysarch
define window_motor extends motor {
    label "Window Motor"
    icon window
}

define rain_sensor extends sensor {
    label "Rain Sensor"
    right { pin lin LIN }
}

architecture "Derived Templates" {
    component bcm: microcontroller { label "BCM" }
    component motor: window_motor
    component rain: rain_sensor

    bcm -> motor { type pwm }
    rain.LIN -> bcm
}
```

## Shape and icon belong to the template

An instance cannot set `shape` and `icon` — that is what keeps identical building blocks
looking the same everywhere. If one component needs a different appearance, derive a local
template for it, like `window_motor` above.

## Overriding library templates

If a local template has the same name as one from the library, the local one wins and sysarch
warns with [W203](/reference/diagnostics#w203). If you only want to extend the library
template, derive from it under a new name.

::: info Looking ahead
Project-specific libraries in separate `.archlib` files, pulled in with `use`, are planned for
v0.2 ([roadmap](/concept/08-roadmap)). Until then, custom templates live in the document.
:::
