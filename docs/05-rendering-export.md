# 05 — Rendering & Export

## Grundsatz: SVG ist die einzige Darstellung

```
                         ┌─► Vorschau (inline SVG im DOM)
DSL → Model → Scene ─► SVG ┼─► .svg Datei / Zwischenablage
                         └─► PNG (SVG rasterisiert)
               │
               └────────► React Flow JSON
```

Das Brainstorming sah einen zusätzlichen Canvas-Renderer für die Vorschau vor.
**Entscheidung:** Die Vorschau zeigt direkt den SVG-String, der auch exportiert wird.
Ein zweiter Renderer wäre genau die Quelle für „im Editor sieht es anders aus als im PNG“,
die vermieden werden soll. Canvas wird nur zum Rasterisieren verwendet.

---

## Themes

v0.1 liefert vier Themes als Design-Tokens (siehe [Theme-Typ](03-domaenenmodell.md#4-theme)):

| Theme | Einsatz |
|-------|---------|
| `automotive-light` | Standard, Dokumentation, Obsidian hell |
| `automotive-dark` | Obsidian dunkel, Bildschirm |
| `presentation` | größere Schrift, kräftigere Linien, breitere Abstände — für Beamer |
| `technical` | schwarz-weiß, druckoptimiert, Unterscheidung nur über Linienform |

Regeln für jedes Theme:

- **Farbe ist nie der einzige Informationsträger.** Signalgruppen unterscheiden sich
  immer auch über Linienstärke, Strichmuster oder Endmarker. `technical` ist der Test
  dafür: Das Diagramm muss ohne Farbe vollständig lesbar sein.
- Kontrast Text/Hintergrund mindestens WCAG AA.
- Schrift: **Inter** (OFL-Lizenz) — Metriken eingebettet, Schrift im SVG-Export per
  `@font-face` als Subset eingebettet, damit das SVG überall gleich aussieht.

Beispiel `automotive-light` (Auszug):

```ts
categories: {
  power:         { fill: "#FFF4D6", border: "#D69E00", text: "#3D2E00" },
  controller:    { fill: "#EAF2FF", border: "#316BD6", text: "#0F2A5C" },
  communication: { fill: "#E7F7EF", border: "#23875B", text: "#0D3B26" },
  // …
}
```

## Linienformen

| Signalgruppe | Arten | Linie | Endmarker |
|--------------|-------|-------|-----------|
| Versorgung | `power` | dick (2,5 px), durchgezogen | Pfeil |
| Versorgung | `ground` | dick, durchgezogen | Masse-Symbol am Ziel |
| Einzelsignal | `signal` `digital` `analog` `pwm` | normal (1,5 px), durchgezogen | Pfeil |
| Bus | `bus` `can` `lin` `spi` `i2c` `uart` `ethernet` | Doppellinie | Pfeil (bzw. beidseitig bei `<->`) |
| Diagnose | `diagnostic` `debug` | normal, gestrichelt | Pfeil |

Pfeilspitzen folgen `direction`: `forward` → am Ziel, `bidirectional` → beidseitig,
`none` → keine.

## Komponentendarstellung

Der Renderer kennt nur **Primitive**: Rechteck (mit Radius), Pfad, Text, Marker
(Pfeil, Masse, Pin, Knotenpunkt). Es gibt in v0.1 keine domänenspezifischen Formen —
eine `half_bridge` ist ein Rechteck mit Kategorie `power` und Pins. Icons pro Template
sind ein Kandidat für v0.2, dann als festes Icon-Set im Theme, nicht frei wählbar.

```
┌──────────────────────┐
│      Half Bridge 1   │   ← Label, Schnitt nach importance
│                      │
● VS              OUT  ●   ← Pin-Marker auf dem Rand, Pin-Label innen
● IN                   │
│                      │
└────────●────●────────┘
         IS   GND
```

---

## SVG-Export

- Ein eigenständiges SVG 1.1 ohne externe Referenzen.
- `viewBox` in Scene-Graph-Einheiten, `width`/`height` in px.
- Stabile Klassen und `data-ref`-Attribute (`data-ref="pin:mcu.CAN_TX"`) für
  Hit-Testing in der Vorschau und für Nachbearbeitung.
- Deterministische Ausgabe: feste Attributreihenfolge, Zahlen auf zwei Nachkommastellen
  gerundet, keine generierten IDs außer aus Modell-IDs abgeleiteten.
- Optional `<title>`/`<desc>` aus Architekturtitel für Barrierefreiheit.

## PNG-Export

**Browser / Obsidian** (keine Bibliothek):

```ts
const img = new Image();
img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
await img.decode();
const canvas = new OffscreenCanvas(scene.width * scale, scene.height * scale);
canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
const blob = await canvas.convertToBlob({ type: "image/png" });
```

- Skalierung 1×, 2× (Standard), 3×.
- Die Schrift ist im SVG eingebettet; vor dem Rasterisieren wird `document.fonts.ready`
  abgewartet.

**CLI** (Node hat kein Canvas): Rasterisierung mit `@resvg/resvg-js`. Das ist die einzige
Rendering-Abhängigkeit im Projekt und liegt ausschließlich in `apps/cli`.

## React-Flow-Export

Ziel ist ein `ReactFlowJsonObject` (`{ nodes, edges, viewport }`), das in eine
React-Flow-Anwendung mit passenden Custom Nodes geladen werden kann. Der Exporter selbst
braucht **keine** React-Flow-Abhängigkeit — er erzeugt nur JSON.

| sysarch | React Flow |
|---------|------------|
| `Component` | Node, `type` = Template-Name, `position` aus Scene Graph |
| `Pin` | Eintrag in `data.pins`, wird im Custom Node zu `<Handle id=NAME>` |
| `Connection` | Edge mit `sourceHandle`/`targetHandle`, `type: "step"` |
| `zone` / `system` | Group-Node; Mitglieder erhalten `parentId` und relative Position |
| `SignalKind` | `edge.data.kind`, Stil über `className` |

```json
{
  "nodes": [
    {
      "id": "processing",
      "type": "group",
      "position": { "x": 320, "y": 0 },
      "style": { "width": 288, "height": 400 },
      "data": { "label": "Processing", "groupType": "zone" }
    },
    {
      "id": "mcu",
      "type": "microcontroller",
      "parentId": "processing",
      "extent": "parent",
      "position": { "x": 32, "y": 64 },
      "width": 224,
      "height": 176,
      "data": {
        "label": "RH850",
        "category": "controller",
        "importance": "primary",
        "pins": [
          { "id": "VDD", "label": "VDD", "kind": "power", "side": "left", "offset": 48 },
          { "id": "HB1_PWM", "label": "HB1_PWM", "kind": "pwm", "side": "right", "offset": 48 }
        ],
        "meta": {}
      }
    }
  ],
  "edges": [
    {
      "id": "mcu.HB1_PWM->hb1.IN#0",
      "source": "mcu",
      "sourceHandle": "HB1_PWM",
      "target": "hb1",
      "targetHandle": "IN",
      "type": "step",
      "label": "PWM",
      "markerEnd": { "type": "arrowclosed" },
      "className": "sa-edge sa-group-single",
      "data": { "kind": "pwm", "points": [[256, 112], [320, 112], [320, 240], [384, 240]] }
    }
  ],
  "viewport": { "x": 0, "y": 0, "zoom": 1 }
}
```

- Körperanschlüsse erhalten virtuelle Handles `__body_<side>`.
- `data.points` enthält die geroutete Geometrie, damit eine Custom-Edge den Pfad exakt
  übernehmen kann statt neu zu routen.
- Zusätzlich wird ein Referenzpaket `@sysarch/reactflow-nodes` (später) die passenden
  Custom Nodes mit Theme-CSS liefern — getrennt vom Core.
