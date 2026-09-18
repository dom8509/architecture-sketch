# 03 — Domain model

## Pipeline

```
Source text (.arch)
   │  lexer          tokens + trivia (comments, whitespace)
   ▼
Syntax tree (AST)    lossless: every node knows its source range
   │  resolver       resolve templates, check ids/pins, infer kinds
   ▼
Semantic model       ArchitectureModel — resolved, validated, framework-free
   │  layout         ranks, order, grid, sizes, routing
   ▼
Scene graph          absolute geometry + theme values, nothing left to decide
   │
   ├─► SVG string    (preview and export — identical)
   ├─► PNG           (rasterized SVG)
   └─► React Flow JSON
```

Every stage is a **pure function** without I/O. Only that way is the result identical in the
browser, in Obsidian and in the CLI, and trivial to test.

```ts
parse(source: string): ParseResult<SyntaxTree>
resolve(tree: SyntaxTree, library: Library): ParseResult<ArchitectureModel>
layout(model: ArchitectureModel, theme: Theme, metrics?: FontMetrics, options?: { icons }): SceneGraph
renderSvg(scene: SceneGraph, options?: { embedFont }): string
toReactFlow(model: ArchitectureModel, scene: SceneGraph): ReactFlowJsonObject
```

---

## 1. Shared types

```ts
/** Source range, 0-based offsets, 1-based line/column for messages. */
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
  /** Suggestions for quick fixes in the editor, e.g. typos in pin names. */
  suggestions?: { label: string; replacement: string; span: Span }[];
}

interface ParseResult<T> {
  value: T;               // always present, possibly incomplete
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

## 2. Syntax tree (AST)

The AST is **lossless** (close to the concrete syntax): it keeps comments and the source
range of every node. That is the prerequisite for visual editing, which produces targeted
text edits instead of rewriting the file
(see [06 Applications](06-applications.md#visual-editing)).

```ts
interface SyntaxNode {
  kind: string;
  span: Span;
  leadingTrivia: Trivia[];   // comments/blank lines before the node
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
  body: Statement[];         // same order as in the source
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
// … remaining nodes follow the grammar in 02-dsl.md
```

---

## 3. Semantic model

Resolved and validated: templates are merged in, pins have a side, connections have a kind
and a normalized direction. Every element points at its AST node through `origin`, so that
clicks in the preview can jump to the source.

```ts
interface ArchitectureModel {
  title: string;
  theme: string;                         // name, resolved only in the layout
  direction: Direction;
  layoutMode: "strict" | "assisted";
  grid?: GridSpec;

  components: Map<ComponentId, Component>;   // insertion order = declaration order
  connections: Connection[];
  /** Root of the group tree; zones are direct children if present. */
  root: Group;
}

type ComponentId = string;
type PinAddress = `${ComponentId}.${string}`;

interface Component {
  id: ComponentId;
  template: string;                      // "block" if none was given
  shape: Shape;                          // from the template, default "rounded"
  icon?: string;                         // name from the icon library
  label: string;
  category: Category;
  size: Size;
  importance: Importance;
  pins: Pin[];                           // order = rendering order
  hints: { row?: number; column?: number };
  meta: Record<string, string>;
  groupPath: GroupId[];                  // e.g. ["processing", "ecu"]
  origin: Span;
}

interface Pin {
  name: string;                          // unique within the component
  label: string;                         // display label, defaults to name
  kind: SignalKind;
  side: Side;
  sideSource: "explicit" | "template" | "inferred";
  origin: Span;
}

interface Endpoint {
  component: ComponentId;
  pin?: string;                          // missing → connects to the component body
}

interface Connection {
  id: string;                            // stable: "<source>-><target>#<n>"
  source: Endpoint;
  target: Endpoint;
  direction: "forward" | "bidirectional" | "none";   // "<-" is normalized to forward
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

### Library

```ts
interface Library {
  templates: Map<string, TemplateDef>;   // from *.archlib
  icons: Map<string, IconDef>;           // from library/icons/*.svg, generated at build time
}

/** Cleaned-up, single-color symbol on a 24×24 grid. */
interface IconDef {
  name: string;
  viewBox: "0 0 24 24";
  /** Path data only; drawn with currentColor as stroke or fill. */
  elements: { d: string; mode: "stroke" | "fill" }[];
}
```

### Invariants (after `resolve`, even when errors are present)

- Every `ComponentId` in `connections`, `grid` and `Group.children` exists. Connections with
  invalid endpoints are dropped, never half-kept.
- Every `Pin` has a concrete `side`.
- Every `icon` exists in `Library.icons`; unknown icons are reported as `E111` and removed,
  and the component is rendered without an icon.
- Every component appears exactly once in the group tree.
- Connection ids are deterministic and do not change when unrelated lines are added.

---

## 4. Theme

In v0.1 themes are TypeScript objects (design tokens), not DSL. Only the theme file knows
pixels and colors.

```ts
interface Theme {
  name: string;
  canvas: { background: string; padding: number };
  typography: {
    fontFamily: string;                  // must be present in FontMetrics
    title: TextStyle;
    component: TextStyle;
    componentPrimary: TextStyle;
    pin: TextStyle;
    connection: TextStyle;
    group: TextStyle;
  };
  spacing: {
    grid: number;                        // 16 — every coordinate is a multiple of this
    nodeGapMain: number;                 // 48 — spacing along the flow direction
    nodeGapCross: number;                // 32 — spacing across it
    zoneGap: number;                     // 64
    pinPitch: number;                    // 16 — spacing between pins
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
  icon: { size: Record<Size, number>; gap: number; strokeWidth: number };  // strokeWidth on the 24×24 grid
  lines: Record<SignalGroup, LineStyle>;
  markers: { arrow: number; ground: number; pin: number };                 // edge lengths in px
  zone: { fill: string; border: string };
  system: { border: string; width: number; radius: number; dash?: number[] };
}

interface TextStyle { size: number; weight: 400 | 500 | 600 | 700; color: string }

interface LineStyle {
  width: number;
  color: string;
  dash?: number[];                       // dashed
  double?: boolean;                      // double line for buses; width = total width, inner ⅓ left clear
  endMarker: "arrow" | "ground" | "none";
}
```

---

## 5. Scene graph

The scene graph is **renderer-neutral and fully computed**: absolute coordinates, resolved
colors, measured text boxes. A renderer makes no more decisions, it only translates.

```ts
interface SceneGraph {
  width: number;
  height: number;
  background: string;
  title: string;                         // for <title>
  icons: IconDef[];                      // every icon in use, sorted by name
  /** Drawing order: zones → systems → connections → components → icons → pins → labels. */
  items: SceneItem[];
}

type SceneItem = SceneRect | SceneShape | ScenePath | SceneText | SceneMarker | SceneIcon;

interface SceneBase {
  /** Back-reference for hit testing and jumping to the source, e.g. "component:mcu", "pin:mcu.CAN_TX". */
  ref?: string;
  className?: string;                    // stable CSS class in the SVG, e.g. "sa-component sa-cat-power"
}

interface SceneRect extends SceneBase {
  type: "rect";
  x: number; y: number; width: number; height: number;
  radius: number;
  fill: string; stroke: string; strokeWidth: number;
  dash?: number[];
}

/** Component body; x/y/width/height is the bounding box, the outline follows from `shape`. */
interface SceneShape extends SceneBase {
  type: "shape";
  shape: Shape;
  x: number; y: number; width: number; height: number;
  radius: number;                        // "rounded": corner radius, "cylinder": half the ellipse height
  fill: string; stroke: string; strokeWidth: number;
}

interface SceneIcon extends SceneBase {
  type: "icon";
  name: string;                          // reference into Library.icons, a <symbol> in the SVG
  x: number; y: number; size: number;
  color: string;
  strokeWidth: number;                   // on the 24×24 grid
}

interface ScenePath extends SceneBase {
  type: "path";
  /** Orthogonal segments only: consecutive points share x or y. */
  points: { x: number; y: number }[];
  stroke: string; strokeWidth: number;
  dash?: number[];
  double?: boolean;
  hops?: { x: number; y: number }[];     // bridges over crossing lines (horizontal segments)
  hopRadius?: number;
  gap?: string;                          // color between the two lines of a double line
}

interface SceneText extends SceneBase {
  type: "text";
  x: number; y: number;
  anchor: "start" | "middle" | "end";
  baseline: "top" | "middle" | "bottom";
  lines: string[];                       // already wrapped in the layout
  style: TextStyle & { fontFamily: string };
  lineHeight: number;                    // px
  ascent: number;                        // top of the line → baseline, px
  width: number;                         // measured width of the widest line
  /** Optional background so that connection labels do not sit on top of lines. */
  halo?: string;
}

interface SceneMarker extends SceneBase {
  type: "marker";
  shape: "arrow" | "ground" | "pin" | "junction";
  x: number; y: number;
  angle: 0 | 90 | 180 | 270;              // the direction the marker points in
  size: number;
  fill: string; stroke: string; strokeWidth: number;
}
```

Text and marker geometry is fully contained in the scene graph (line height, baseline, width,
marker size), so that the renderer needs neither font metrics nor a theme.

### Why a scene graph of its own instead of SVG directly?

- The React Flow output needs positions, but no SVG.
- Hit testing and selection in the editor work on `ref` and rectangles, not on the DOM.
- Snapshot tests on the scene graph read better than SVG diffs.
- Further targets (PDF, PPTX shapes) are then pure translators.
