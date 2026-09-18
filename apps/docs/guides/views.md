# Views

One source, several levels of abstraction: a `view` decides which components, pins and
connections a diagram shows. The model stays the same — only the picture changes.

Typical use: an overview for the presentation, an interface view for the discussion with a
supplier, and a detailed view with every pin for the schematic review.

## Declaring views

`view <id>` at the top of the architecture declares a view; `label` gives it a display name.

```sysarch code-only
view overview { label "Overview" }
view detailed
```

Without a `view` nothing changes: the document keeps producing exactly one diagram.

## Showing elements in a view

`show in <view>[, <view>]` restricts an element to the listed views. It is allowed on
zones, systems, components, pins and connections. Elements without `show in` appear in
every view.

```sysarch view=overview
architecture "Window lifter" {
    view overview { label "Overview" }
    view detailed

    component mcu: microcontroller {
        label "BCM"
        pin pwm HB_PWM { show in detailed }
        pin analog IS { show in detailed }
    }
    component hb: half_bridge { show in detailed }
    component motor: motor

    mcu.HB_PWM -> hb.IN { show in detailed }
    hb.IS -> mcu.IS     { show in detailed }
    hb.OUT -> motor     { show in detailed }
    mcu -> motor        { label "Window" show in overview }
}
```

The same source in the view `detailed` — the half bridge, its pins and the connections
between them appear, the summarising arrow of the overview does not:

```sysarch view=detailed
architecture "Window lifter" {
    view overview { label "Overview" }
    view detailed

    component mcu: microcontroller {
        label "BCM"
        pin pwm HB_PWM { show in detailed }
        pin analog IS { show in detailed }
    }
    component hb: half_bridge { show in detailed }
    component motor: motor

    mcu.HB_PWM -> hb.IN { show in detailed }
    hb.IS -> mcu.IS     { show in detailed }
    hb.OUT -> motor     { show in detailed }
    mcu -> motor        { label "Window" show in overview }
}
```

## The rules in one paragraph

`show in` only ever narrows, it never widens:

- a pin is only shown where its component is shown,
- a component only where its zone and its systems are shown,
- a connection only where **both** of its components are shown.

If the pin of an endpoint is hidden in a view, the connection docks on the body of the
component — as with [`pins none`](./presentation#hiding-pins). Zones and systems without
visible content disappear, and so do empty rows and columns of a `grid`.

If an element's `show in` does not overlap with the views of its surroundings, it is shown
nowhere and you get [W204](/reference/diagnostics#w204); a view that shows no component at
all reports [W205](/reference/diagnostics#w205).

## Rendering views

`sysarch render` writes one file per view:

```console
$ sysarch render window-lifter.arch
window-lifter.arch → window-lifter-overview.svg
window-lifter.arch → window-lifter-detailed.svg
```

`--view <name>` picks a single one — useful for a build step that only needs the overview:

```console
$ sysarch render window-lifter.arch --view overview --out docs/overview.svg
```

In the [web app](./web-app) and in [Obsidian](./obsidian) a selector appears next to the
diagram as soon as the source declares views; exports follow the selection and carry the
view in their file name.

## `check` sees everything

Views are a matter of rendering, not of the model. `sysarch check` validates every
component and every connection, including those that no view shows — a pin left out of the
overview is still checked against its connections.
