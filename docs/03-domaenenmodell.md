# 03 — Domänenmodell

## Pipeline

```
Quelltext (.arch)
   │  lexer          Token + Trivia (Kommentare, Whitespace)
   ▼
Syntaxbaum (AST)     verlustfrei: jeder Knoten kennt seinen Quellbereich
   │  resolver       Templates auflösen, IDs/Pins prüfen, Typen ableiten
   ▼
Semantic Model       ArchitectureModel — aufgelöst, validiert, frameworkfrei
   │  layout         Ränge, Reihenfolge, Grid, Größen, Routing
   ▼
Scene Graph          absolute Geometrie + Theme-Werte, nichts mehr zu entscheiden
   │
   ├─► SVG-String    (Vorschau und Export — identisch)
   ├─► PNG           (SVG rasterisiert)
   └─► React Flow JSON
```

Jede Stufe ist eine **reine Funktion** ohne I/O. Nur so ist das Ergebnis in Browser,
Obsidian und CLI identisch und trivial testbar.

```ts
parse(source: string): ParseResult<SyntaxTree>
resolve(tree: SyntaxTree, library: Library): ParseResult<ArchitectureModel>
layout(model: ArchitectureModel, theme: Theme, metrics: FontMetrics): SceneGraph
renderSvg(scene: SceneGraph): string
toReactFlow(model: ArchitectureModel, scene: SceneGraph): ReactFlowJsonObject
```

---

## 1. Gemeinsame Typen

```ts
/** Quellbereich, 0-basierte Offsets, 1-basierte Zeile/Spalte für Meldungen. */
interface Span {
  start: number;
  end: number;
  line: number;
  column: number;
}

type Severity = "error" | "warning" | "info";

interface Diagnostic {
  code: `${"E" | "W" | "I"}${number}`;
  severity: Severity;
  message: string;
  span: Span;
  /** Vorschläge für Quick-Fixes im Editor, z. B. Tippfehler bei Pin-Namen. */
  suggestions?: { label: string; replacement: string; span: Span }[];
}

interface ParseResult<T> {
  value: T;               // immer vorhanden, ggf. unvollständig
  diagnostics: Diagnostic[];
}

type Direction = "LR" | "TB";
type Side = "left" | "right" | "top" | "bottom";
type Size = "small" | "medium" | "large";
type Importance = "primary" | "secondary";

type SignalKind =
  | "power" | "ground"
  | "signal" | "digital" | "analog" | "pwm"
  | "bus" | "can" | "lin" | "spi" | "i2c" | "uart" | "ethernet"
  | "diagnostic" | "debug";

type SignalGroup = "supply" | "single" | "bus" | "diagnostic";

type Shape = "rounded" | "rect" | "circle" | "hexagon" | "cylinder";

type Category =
  | "power" | "controller" | "communication" | "sensor"
  | "actuator" | "software" | "external" | "generic";
```

---

## 2. Syntaxbaum (AST)

Der AST ist **verlustfrei** (Concrete-Syntax-nah): Er behält Kommentare und die
Quellbereiche jedes Knotens. Das ist Voraussetzung für das visuelle Editieren, das
gezielte Textänderungen erzeugt statt die Datei neu zu schreiben
(siehe [06 Anwendungen](06-anwendungen.md#visuelles-editieren)).

```ts
interface SyntaxNode {
  kind: string;
  span: Span;
  leadingTrivia: Trivia[];   // Kommentare/Leerzeilen vor dem Knoten
}

interface Trivia {
  kind: "comment" | "blankLine";
  text: string;
  span: Span;
}

interface SyntaxTree extends SyntaxNode {
  kind: "Document";
  defines: DefineNode[];
  architecture?: ArchitectureNode;
}

interface ArchitectureNode extends SyntaxNode {
  kind: "Architecture";
  title: StringLit;
  body: Statement[];         // Reihenfolge wie im Quelltext
}

type Statement =
  | ThemeStmt | DirectionStmt | LayoutStmt
  | ZoneNode | SystemNode | ComponentNode | ConnectionNode;

interface ComponentNode extends SyntaxNode {
  kind: "Component";
  id: Ident;
  template?: Ident;
  body?: ComponentStmt[];
}

interface ConnectionNode extends SyntaxNode {
  kind: "Connection";
  from: EndpointNode;
  arrow: "->" | "<-" | "<->" | "--";
  to: EndpointNode;
  body?: (LabelStmt | TypeStmt)[];
}

interface Ident extends SyntaxNode { kind: "Ident"; name: string }
interface StringLit extends SyntaxNode { kind: "String"; value: string }
// … übrige Knoten analog zur Grammatik in 02-dsl.md
```

---

## 3. Semantic Model

Aufgelöst und validiert: Templates sind eingemischt, Pins haben eine Seite, Verbindungen
einen Typ und eine normalisierte Richtung. Jedes Element verweist über `origin` auf seinen
AST-Knoten, damit Klicks in der Vorschau zur Quelle springen können.

```ts
interface ArchitectureModel {
  title: string;
  theme: string;                         // Name, Auflösung erst im Layout
  direction: Direction;
  layoutMode: "strict" | "assisted";
  grid?: GridSpec;

  components: Map<ComponentId, Component>;   // Einfügereihenfolge = Deklarationsreihenfolge
  connections: Connection[];
  /** Wurzel des Gruppenbaums; Zonen sind direkte Kinder, falls vorhanden. */
  root: Group;
}

type ComponentId = string;
type PinAddress = `${ComponentId}.${string}`;

interface Component {
  id: ComponentId;
  template: string;                      // "block", wenn keiner angegeben
  shape: Shape;                          // aus Template, Standard "rounded"
  icon?: string;                         // Name aus der Icon-Bibliothek
  label: string;
  category: Category;
  size: Size;
  importance: Importance;
  pins: Pin[];                           // Reihenfolge = Darstellungsreihenfolge
  hints: { row?: number; column?: number };
  meta: Record<string, string>;
  groupPath: GroupId[];                  // z. B. ["processing", "ecu"]
  origin: Span;
}

interface Pin {
  name: string;                          // eindeutig innerhalb der Komponente
  label: string;                         // Anzeigelabel, Standard = name
  kind: SignalKind;
  side: Side;
  sideSource: "explicit" | "template" | "inferred";
  origin: Span;
}

interface Endpoint {
  component: ComponentId;
  pin?: string;                          // fehlt → Anschluss am Komponentenkörper
}

interface Connection {
  id: string;                            // stabil: "<source>-><target>#<n>"
  source: Endpoint;
  target: Endpoint;
  direction: "forward" | "bidirectional" | "none";   // "<-" wird zu forward normalisiert
  kind: SignalKind;
  kindSource: "explicit" | "inferred";
  label?: string;
  origin: Span;
}

type GroupId = string;

interface Group {
  id: GroupId;
  type: "root" | "zone" | "system";
  label?: string;
  children: (GroupId | ComponentId)[];
  origin: Span;
}

interface GridSpec {
  rows: (ComponentId | null)[][];        // null = "."
  origin: Span;
}
```

### Bibliothek

```ts
interface Library {
  templates: Map<string, TemplateDef>;   // aus *.archlib
  icons: Map<string, IconDef>;           // aus library/icons/*.svg, zur Build-Zeit erzeugt
}

/** Bereinigtes, einfarbiges Symbol im 24×24-Raster. */
interface IconDef {
  name: string;
  viewBox: "0 0 24 24";
  /** Nur Pfaddaten; gezeichnet mit currentColor als Strich oder Fläche. */
  elements: { d: string; mode: "stroke" | "fill" }[];
}
```

### Invarianten (nach `resolve`, auch bei vorhandenen Fehlern)

- Jede `ComponentId` in `connections`, `grid` und `Group.children` existiert.
  Verbindungen mit ungültigen Endpunkten werden verworfen, nicht halb übernommen.
- Jeder `Pin` hat eine konkrete `side`.
- Jedes `icon` existiert in `Library.icons`; unbekannte Icons werden mit `E111` gemeldet
  und entfernt, die Komponente wird ohne Icon gerendert.
- Jede Komponente ist genau einmal im Gruppenbaum enthalten.
- Connection-IDs sind deterministisch und ändern sich nicht, wenn unabhängige Zeilen
  hinzukommen.

---

## 4. Theme

Themes sind in v0.1 TypeScript-Objekte (Design-Tokens), keine DSL. Nur die Theme-Datei
kennt Pixel und Farben.

```ts
interface Theme {
  name: string;
  canvas: { background: string; padding: number };
  typography: {
    fontFamily: string;                  // muss in FontMetrics vorhanden sein
    title: TextStyle;
    component: TextStyle;
    componentPrimary: TextStyle;
    pin: TextStyle;
    connection: TextStyle;
    group: TextStyle;
  };
  spacing: {
    grid: number;                        // 16 — alle Koordinaten sind Vielfache davon
    nodeGapMain: number;                 // 48 — Abstand entlang der Flussrichtung
    nodeGapCross: number;                // 32 — Abstand quer dazu
    zoneGap: number;                     // 64
    pinPitch: number;                    // 16 — Abstand zwischen Pins
    groupPadding: number;
  };
  component: {
    radius: number;
    borderWidth: Record<Importance, number>;
    padding: number;
    minWidth: Record<Size, number>;
    minHeight: Record<Size, number>;
  };
  categories: Record<Category, { fill: string; border: string; text: string }>;
  icon: { size: Record<Size, number>; gap: number; strokeWidth: number };
  lines: Record<SignalGroup, LineStyle>;
  zone: { fill: string; border: string };
  system: { border: string; dash?: number[] };
}

interface TextStyle { size: number; weight: 400 | 500 | 600 | 700; color: string }

interface LineStyle {
  width: number;
  color: string;
  dash?: number[];                       // gestrichelt
  double?: boolean;                      // Doppellinie für Busse
  endMarker: "arrow" | "ground" | "none";
}
```

---

## 5. Scene Graph

Der Scene Graph ist **renderer-neutral und vollständig ausgerechnet**: absolute
Koordinaten, aufgelöste Farben, gemessene Textboxen. Ein Renderer trifft keine
Entscheidungen mehr, er übersetzt nur.

```ts
interface SceneGraph {
  width: number;
  height: number;
  background: string;
  /** Zeichenreihenfolge: Zonen → Systeme → Verbindungen → Komponenten → Icons → Pins → Labels. */
  items: SceneItem[];
}

type SceneItem = SceneRect | SceneShape | ScenePath | SceneText | SceneMarker | SceneIcon;

interface SceneBase {
  /** Rückverweis für Hit-Testing und Quellsprung, z. B. "component:mcu", "pin:mcu.CAN_TX". */
  ref?: string;
  className?: string;                    // stabile CSS-Klasse im SVG, z. B. "sa-component sa-cat-power"
}

interface SceneRect extends SceneBase {
  type: "rect";
  x: number; y: number; width: number; height: number;
  radius: number;
  fill: string; stroke: string; strokeWidth: number;
  dash?: number[];
}

/** Komponentenkörper; x/y/width/height ist die Hülle, die Kontur ergibt sich aus `shape`. */
interface SceneShape extends SceneBase {
  type: "shape";
  shape: Shape;
  x: number; y: number; width: number; height: number;
  radius: number;                        // nur für "rounded"
  fill: string; stroke: string; strokeWidth: number;
}

interface SceneIcon extends SceneBase {
  type: "icon";
  name: string;                          // Verweis auf Library.icons, im SVG als <symbol>
  x: number; y: number; size: number;
  color: string;
}

interface ScenePath extends SceneBase {
  type: "path";
  /** Nur orthogonale Segmente: aufeinanderfolgende Punkte teilen x oder y. */
  points: { x: number; y: number }[];
  stroke: string; strokeWidth: number;
  dash?: number[];
  double?: boolean;
}

interface SceneText extends SceneBase {
  type: "text";
  x: number; y: number;
  anchor: "start" | "middle" | "end";
  baseline: "top" | "middle" | "bottom";
  lines: string[];                       // umbrochen bereits im Layout
  style: TextStyle & { fontFamily: string };
  /** Optionaler Hintergrund, damit Verbindungslabels Linien nicht überlagern. */
  halo?: string;
}

interface SceneMarker extends SceneBase {
  type: "marker";
  shape: "arrow" | "ground" | "pin" | "junction";
  x: number; y: number;
  angle: 0 | 90 | 180 | 270;
  fill: string; stroke: string;
}
```

### Warum ein eigener Scene Graph statt direkt SVG?

- Die React-Flow-Ausgabe braucht Positionen, aber kein SVG.
- Hit-Testing und Auswahl im Editor arbeiten auf `ref` und Rechtecken, nicht auf DOM.
- Snapshot-Tests auf dem Scene Graph sind lesbarer als SVG-Diffs.
- Weitere Ziele (PDF, PPTX-Shapes) sind später reine Übersetzer.
