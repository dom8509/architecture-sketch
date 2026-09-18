# What is sysarch?

sysarch is a small language and a toolset for **architecture diagrams of ECUs, embedded
systems and system architectures**. You describe components, pins and connections as text —
sysarch places, routes and draws the diagram.

```sysarch
architecture "Zonal ECU" {
    direction LR

    zone supply {
        label "Power"
        component kl30: power_source { label "KL30" }
        component psu: power_supply
    }

    zone processing {
        label "Processing"
        component mcu: microcontroller {
            label "S32K344"
            pin power VDD
            pin pwm HB_PWM
        }
    }

    zone output {
        label "Actuation"
        component hb: half_bridge { label "TLE9201" }
        component motor: motor
    }

    kl30 -> psu.VIN     { label "12 V" type power }
    psu.VOUT -> mcu.VDD { label "3.3 V" }
    mcu.HB_PWM -> hb.IN { label "PWM" }
    hb.OUT -> motor
}
```

## What it is for

Architecture diagrams usually end up in PowerPoint, Visio, draw.io or Excalidraw. Every
diagram then looks different, none of them can be diffed, and interfaces are only drawn.
Mermaid solves the text problem, but it knows nothing about pins, system boundaries or
domain-specific building blocks.

| Tool | Optimized for |
|----------|---------------|
| Excalidraw | freedom |
| Mermaid | quick, generic diagrams |
| React Flow | interactive graph applications |
| **sysarch** | **consistent embedded and system architectures** |

The constraints are the point: ten diagrams from ten engineers look as if one person had
drawn them all.

## Core principles

1. **The text is the source of truth.** SVG, PNG and React Flow JSON are generated from it.
2. **One layout model.** Preview and export come from the same scene graph — what you see in
   the editor is what gets exported.
3. **Design system instead of pixels.** No coordinates, no free-form colors or font sizes.
   Only semantic steps such as `size`, `importance` and `category`; the theme decides.
4. **Deterministic.** The same input yields byte-identical SVG — in the browser, in Obsidian
   and in CI.

## The building blocks

| Building block | Purpose |
|----------|---------|
| **Language** | `architecture`, `component`, `pin`, connections, `zone`, `system`, `layout`, `define` — see [reference](/reference/language) |
| **Library** | ready-made templates such as `microcontroller`, `half_bridge`, `can_transceiver` — see [library](/reference/library) |
| **Web app** | editor with live preview, diagnostics, export and share links — [open ↗](/app/) |
| **Obsidian plugin** | ` ```sysarch ` code blocks, `.arch` files, library in the sidebar |
| **CLI** | `render`, `check`, `fmt` for scripts and CI |

## What sysarch deliberately is not

- not a free-form canvas — you steer placement declaratively with `grid` and `hint`
- not a drawing tool for arbitrary shapes or embedded images
- not a general-purpose graph renderer for every kind of diagram

Where things go from here is described in the [roadmap](/concept/08-roadmap).
