# Quickstart

From an empty editor to a diagram with pins, connections and zones in ten minutes. Nothing to
install.

## 1. Open the editor

Open the <a href="/sysarch/app/" target="_blank">web app ↗</a>. The source text is on the left,
the live preview on the right, the diagnostics at the bottom. Click **New** to start with an
empty architecture.

::: tip Prefer Obsidian?
Install the plugin as described under [Installation](./installation#obsidian-plugin) and write
the examples into a code block with the language `sysarch`. Every example on this page also
has an **Open in the web app** link.
:::

## 2. Your first component

Every diagram is an `architecture` with a title. Inside it you create components:
`component <id>: <template>`. The template comes from the
[library](/reference/library) and determines shape, icon, color and default pins.

```sysarch
architecture "Power Window" {
    component mcu: microcontroller { label "S32K344" }
}
```

- `mcu` is the **ID** — you use it to refer to the component later on.
- `label` is the displayed name. Without a `label`, sysarch shows the template's label.

## 3. Connecting components

Connections go at the end of the architecture. `a -> b` draws an arrow from `a` to `b`. Where
the components end up and how the line runs is up to the layout.

```sysarch
architecture "Power Window" {
    component mcu: microcontroller { label "S32K344" }
    component driver: half_bridge { label "Motor Driver" }
    component motor: motor { label "Window Motor" }

    mcu -> driver.IN
    driver.OUT -> motor
}
```

`driver.IN` and `driver.OUT` are **pins** — the half bridge brings them along from its template.
Without a pin (`motor`), the line docks onto the body of the component.

## 4. Your own pins and signal kinds

You declare pins with `pin <kind> <NAME>`. The kind determines the line style: supply lines are
thick, buses are doubled, diagnostics are dashed. `label` puts a caption on a connection, and
`type` pins down the kind of a connection.

```sysarch
architecture "Power Window" {
    component battery: battery { label "KL30" }
    component mcu: microcontroller {
        label "S32K344"
        pin power VDD
        pin pwm MOTOR_PWM
        pin analog MOTOR_IS
    }
    component driver: half_bridge { label "Motor Driver" }
    component motor: motor { label "Window Motor" }

    battery -> mcu.VDD         { label "12 V" }
    mcu.MOTOR_PWM -> driver.IN { label "PWM" }
    driver.IS -> mcu.MOTOR_IS  { label "Current" }
    driver.OUT -> motor        { label "Motor" type power }
}
```

Which side a pin sits on is derived by sysarch from the connections. All signal kinds are
listed under [Pins and connections](/guides/pins-and-connections).

## 5. Structuring with zones

Zones are bands along the flow direction. As soon as you use one zone, every component has to
live in a zone.

```sysarch
architecture "Power Window" {
    direction LR

    zone supply {
        label "Supply"
        component battery: battery { label "KL30" }
    }

    zone control {
        label "Control"
        component mcu: microcontroller {
            label "S32K344"
            pin power VDD
            pin pwm MOTOR_PWM
            pin analog MOTOR_IS
        }
    }

    zone output {
        label "Actuation"
        component driver: half_bridge { label "Motor Driver" }
        component motor: motor { label "Window Motor" }
    }

    battery -> mcu.VDD         { label "12 V" }
    mcu.MOTOR_PWM -> driver.IN { label "PWM" }
    driver.IS -> mcu.MOTOR_IS  { label "Current" }
    driver.OUT -> motor        { label "Motor" type power }
}
```

## 6. Reading errors

If you make a typo, the preview keeps showing the last valid state and the diagnostic names
the line, column, code and usually a suggestion. Here is how `sysarch check` reports it:

```sysarch code-only
architecture "Power Window" {
    component mcu: microcontroller { pin pwm MOTOR_PWM }
    component driver: half_bridge

    mcu.MOTOR_PMW -> driver.IN
}
```

```text
power-window.arch:5:9: error E103: component `mcu` has no pin `MOTOR_PMW` — did you mean `MOTOR_PWM`?
```

In the web app you apply the suggestion right in the editor. Every code is explained on the
[diagnostics](/reference/diagnostics) page.

## 7. Exporting and sharing

From the toolbar of the web app:

- **SVG**, **PNG** (1×, 2×, 3×) and **React Flow** download the diagram.
- **Share link** copies a link that carries the source text — no server involved.
- **Save** writes an `.arch` file that you can put under version control.

## Where to go next

- [Installation](./installation) — set up the Obsidian plugin and the CLI
- [Guides](/guides/) — control the layout, presentation views, custom templates, CI
- [Library](/reference/library) — every building block that ships with sysarch
