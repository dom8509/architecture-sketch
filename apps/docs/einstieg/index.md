# Was ist sysarch?

sysarch ist eine kleine Sprache und ein Werkzeugsatz für **Architekturdiagramme von
Steuergeräten, Embedded- und Systemarchitekturen**. Du beschreibst Komponenten, Pins und
Verbindungen als Text — sysarch platziert, routet und zeichnet das Diagramm.

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

## Wofür es gedacht ist

Architekturdiagramme entstehen oft in PowerPoint, Visio, draw.io oder Excalidraw. Dann sieht
jedes Diagramm anders aus, lässt sich nicht diffen, und Schnittstellen sind nur gezeichnet.
Mermaid löst das Text-Problem, kennt aber weder Pins noch Systemgrenzen noch Bausteine aus
der Domäne.

| Werkzeug | optimiert auf |
|----------|---------------|
| Excalidraw | Freiheit |
| Mermaid | schnelle, generische Diagramme |
| React Flow | interaktive Graph-Anwendungen |
| **sysarch** | **konsistente Embedded- und Systemarchitekturen** |

Die Einschränkungen sind der Vorteil: Zehn Diagramme von zehn Entwicklern sehen aus, als
hätte sie eine Person erstellt.

## Grundprinzipien

1. **Der Text ist das führende Modell.** SVG, PNG und React-Flow-JSON werden daraus erzeugt.
2. **Ein Layoutmodell.** Vorschau und Export kommen aus demselben Szenengraphen — was du im
   Editor siehst, wird exportiert.
3. **Design-System statt Pixel.** Keine Koordinaten, keine freien Farben oder Schriftgrößen.
   Nur semantische Stufen wie `size`, `importance` und `category`; das Theme entscheidet.
4. **Deterministisch.** Gleiche Eingabe ergibt byte-gleiches SVG — im Browser, in Obsidian und
   in der CI.

## Die Bausteine

| Baustein | Aufgabe |
|----------|---------|
| **Sprache** | `architecture`, `component`, `pin`, Verbindungen, `zone`, `system`, `layout`, `define` — siehe [Referenz](/referenz/sprache) |
| **Bibliothek** | fertige Templates wie `microcontroller`, `half_bridge`, `can_transceiver` — siehe [Bibliothek](/referenz/bibliothek) |
| **Web-App** | Editor mit Live-Vorschau, Diagnosen, Export und Teilen-Links — [öffnen ↗](/app/) |
| **Obsidian-Plugin** | ` ```sysarch `-Codeblöcke, `.arch`-Dateien, Bibliothek in der Seitenleiste |
| **CLI** | `render`, `check`, `fmt` für Skripte und CI |

## Was sysarch bewusst nicht ist

- kein frei verschiebbarer Canvas — Platzierung steuerst du deklarativ über `grid` und `hint`
- kein Zeichenwerkzeug für beliebige Formen oder eingebettete Bilder
- kein allgemeiner Graph-Renderer für jede Art von Diagramm

Wie es weitergeht, steht in der [Roadmap](/konzept/08-roadmap).
