# 01 — Zielbild

## Problem

Architekturdiagramme für Steuergeräte und Embedded-Systeme entstehen heute in
PowerPoint, Visio, draw.io oder Excalidraw. Das Ergebnis:

- Jedes Diagramm sieht anders aus (Abstände, Farben, Schriften, Pfeilstile).
- Diagramme lassen sich nicht diffen, reviewen oder in der CI prüfen.
- Pins und Schnittstellen sind nur gezeichnet, nicht modelliert.
- Dieselbe Architektur wird für Übersicht, Schnittstellen und Detail mehrfach gezeichnet
  und driftet auseinander.

Mermaid löst das Text-Problem, kennt aber weder Pins noch Systemgrenzen noch
domänenspezifische Bausteine — und sein Layout lässt sich kaum steuern.

## Produkt

Ein kleiner Architecture-as-Code-Editor speziell für System- und Embedded-Architekturen:

```
┌────────────────────────────────────────────────────────────┐
│                    Architecture Studio                     │
├───────────────────────┬────────────────────────────────────┤
│ Architecture DSL      │ Live Preview                       │
│                       │                                    │
│ component bcm: mcu {  │     ┌──────────────┐               │
│   label "RH850"       │     │    RH850     │               │
│ }                     │     │ CAN      SPI │               │
│                       │     └───●─────●────┘               │
│ bcm.CAN -> canbus     │         │                          │
│                       │         ▼                          │
│                       │      CAN Bus                       │
├───────────────────────┴────────────────────────────────────┤
│ Diagnosen │ PNG │ SVG │ React Flow │ Copy │ Präsentation   │
└────────────────────────────────────────────────────────────┘
```

Derselbe Core läuft

- als eigenständige **Web-App** (Editor + Live-Vorschau),
- als **Obsidian-Plugin** (Codeblock ```` ```sysarch ````),
- als **Headless-CLI** für CI/CD (`sysarch render`, `sysarch check`),
- später optional als **VS-Code-Extension**.

## Zielgruppen

| Rolle | Nutzen |
|-------|--------|
| System-Architekt:innen | Architektur als reviewbares Artefakt im Repo |
| Hardware-/Software-Entwickler:innen | Schnittstellen und Pins eindeutig benannt |
| Projektleitung | präsentationstaugliche Diagramme ohne Nacharbeit |
| Reviews / Kundentermine | mehrere Abstraktionsebenen aus einer Quelle |

## Abgrenzung — was sysarch bewusst nicht ist

- **Kein Whiteboard.** Kein frei verschiebbarer Canvas als primäres Layout.
- **Kein generischer Graph-Layouter.** Klare Regeln für technische Diagramme plus
  deklarative Overrides decken 80 % ab; der Rest ist Absicht, kein Bug.
- **Kein Schaltplan-Tool.** Pins sind logische Schnittstellen, keine Bauteil-Footprints.
- **Kein Modellierungswerkzeug à la SysML** — zumindest nicht in v0.x. Plausibilitätsprüfungen
  sind eine spätere Ausbaustufe (siehe [Roadmap](08-roadmap.md)).

## Qualitätsziele

| Ziel | Messbar als |
|------|-------------|
| Determinismus | gleiche Eingabe + gleiche Version → byte-gleiches SVG auf allen Plattformen |
| WYSIWYG | Vorschau ist dasselbe SVG-Dokument wie der Export |
| Geschwindigkeit | Parse + Layout + Render < 50 ms für 50 Komponenten / 100 Verbindungen |
| Fehlertoleranz | Parser liefert bei Syntaxfehlern Teilmodell + Diagnosen mit Zeile/Spalte |
| Konsistenz | kein DSL-Konstrukt erlaubt Pixelwerte, Farben oder Schriftgrößen im Diagramm |
