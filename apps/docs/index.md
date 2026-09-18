---
layout: home

hero:
  name: sysarch
  text: Architecture as code
  tagline: Embedded and system architectures from plain text — with pins, zones, fixed spacing and reproducible SVG, PNG and React Flow JSON.
  actions:
    - theme: brand
      text: Quickstart
      link: /getting-started/quickstart
    - theme: alt
      text: Try it in the browser ↗
      link: /app/
      target: _blank
    - theme: alt
      text: What is sysarch?
      link: /getting-started/

features:
  - title: The text is the model
    details: Diagrams are diffable, reviewable and checkable in CI. SVG, PNG and React Flow are generated from them.
  - title: Pins as first-class elements
    details: Interfaces are modeled, not drawn. A typo in a pin name is an error — with a suggestion.
  - title: Design system instead of pixels
    details: No coordinates, no colors, no font sizes. The theme decides — ten diagrams look like the work of one person.
  - title: The same picture everywhere
    details: Web app, Obsidian and CLI produce byte-identical SVG from the same core.
---

## What it looks like

```sysarch
architecture "Door ECU" {
    direction LR

    component mcu: microcontroller {
        label "S32K3"
        pin digital PWM
    }
    component driver: half_bridge { label "Door Motor Driver" }
    component motor: motor { label "Window Motor" }

    mcu.PWM -> driver.IN { label "PWM" type digital }
    driver.OUT -> motor  { label "12 V PWM" type power }
}
```

Continue with the [quickstart](/getting-started/quickstart) — your first diagram in ten minutes.
