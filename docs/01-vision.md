# 01 — Vision

## Problem

Architecture diagrams for ECUs and embedded systems are drawn today in PowerPoint, Visio,
draw.io or Excalidraw. The result:

- Every diagram looks different (spacing, colors, fonts, arrow styles).
- Diagrams cannot be diffed, reviewed or checked in CI.
- Pins and interfaces are only drawn, not modeled.
- The same architecture is drawn several times — for the overview, for the interfaces, for
  the detail — and the copies drift apart.

Mermaid solves the text problem, but knows nothing about pins, system boundaries or
domain-specific building blocks — and its layout is barely controllable.

## Product

A small architecture-as-code editor made specifically for system and embedded
architectures:

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
│ Diagnostics │ PNG │ SVG │ React Flow │ Copy │ Presentation │
└────────────────────────────────────────────────────────────┘
```

The same core runs

- as a standalone **web app** (editor + live preview),
- as an **Obsidian plugin** (code block ```` ```sysarch ````),
- as a **headless CLI** for CI/CD (`sysarch render`, `sysarch check`),
- later, optionally, as a **VS Code extension**.

## Audience

| Role | Benefit |
|-------|--------|
| System architects | architecture as a reviewable artifact in the repo |
| Hardware and software engineers | interfaces and pins named unambiguously |
| Project leads | presentation-ready diagrams with no rework |
| Reviews / customer meetings | several levels of abstraction from one source |

## Scope — what sysarch deliberately is not

- **Not a whiteboard.** No freely draggable canvas as the primary layout.
- **Not a generic graph layouter.** Clear rules for technical diagrams plus declarative
  overrides cover 80 %; the rest is intent, not a bug.
- **Not a schematic tool.** Pins are logical interfaces, not component footprints.
- **Not a SysML-style modeling tool** — at least not in v0.x. Consistency checks are a
  later stage (see [Roadmap](08-roadmap.md)).

## Quality goals

| Goal | Measured as |
|------|-------------|
| Determinism | same input + same version → byte-identical SVG on every platform |
| WYSIWYG | the preview is the same SVG document as the export |
| Speed | parse + layout + render < 50 ms for 50 components / 100 connections |
| Error tolerance | on syntax errors the parser still returns a partial model plus diagnostics with line/column |
| Consistency | no DSL construct allows pixel values, colors or font sizes in the diagram |
