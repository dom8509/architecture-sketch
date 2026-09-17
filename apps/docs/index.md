---
layout: home

hero:
  name: sysarch
  text: Architektur als Code
  tagline: Embedded- und Systemarchitekturen aus Text — mit Pins, Zonen, festen Abständen und reproduzierbarem SVG, PNG und React-Flow-JSON.
  actions:
    - theme: brand
      text: Schnellstart
      link: /einstieg/schnellstart
    - theme: alt
      text: Im Browser ausprobieren ↗
      link: /app/
      target: _blank
    - theme: alt
      text: Was ist sysarch?
      link: /einstieg/

features:
  - title: Text ist das Modell
    details: Diagramme sind diffbar, reviewbar und in der CI prüfbar. SVG, PNG und React Flow werden daraus erzeugt.
  - title: Pins als First-Class-Elemente
    details: Schnittstellen sind modelliert, nicht gezeichnet. Tippfehler bei Pin-Namen sind Fehler — mit Vorschlag.
  - title: Design-System statt Pixel
    details: Keine Koordinaten, keine Farben, keine Schriftgrößen. Das Theme entscheidet — zehn Diagramme sehen aus wie aus einer Hand.
  - title: Überall dasselbe Bild
    details: Web-App, Obsidian und CLI erzeugen byte-gleiches SVG aus demselben Kern.
---

## So sieht das aus

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

Weiter mit dem [Schnellstart](/einstieg/schnellstart) — in zehn Minuten zum ersten eigenen Diagramm.
