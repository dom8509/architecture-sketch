import type { Arrow, Direction, Importance, LayoutMode, PinDisplay, Side, StackMode, Size, Span } from "../types.js";

export interface Trivia {
  kind: "comment" | "blankLine";
  text: string;
  span: Span;
}

export interface SyntaxNode {
  kind: string;
  span: Span;
  /** Comments/blank lines before the node. */
  leadingTrivia: Trivia[];
  /** Comments/blank lines before the closing `}` of a block. */
  closingTrivia?: Trivia[];
}

export interface Ident extends SyntaxNode { kind: "Ident"; name: string }
export interface StringLit extends SyntaxNode { kind: "String"; value: string }

export interface SyntaxTree extends SyntaxNode {
  kind: "Document";
  defines: DefineNode[];
  architecture?: ArchitectureNode;
}

// ── Architecture ─────────────────────────────────────────────

export interface ArchitectureNode extends SyntaxNode {
  kind: "Architecture";
  title: StringLit;
  /** Order as in the source text. */
  body: Statement[];
}

export type Statement =
  | ThemeStmt | DirectionStmt | PinsStmt | StackStmt | LayoutStmt
  | ZoneNode | SystemNode | ComponentNode | ConnectionNode;

export interface ThemeStmt extends SyntaxNode { kind: "Theme"; name: Ident }
export interface DirectionStmt extends SyntaxNode { kind: "Direction"; value: Direction }
export interface PinsStmt extends SyntaxNode { kind: "Pins"; value: PinDisplay }
export interface StackStmt extends SyntaxNode { kind: "Stack"; value: StackMode }

export interface LayoutStmt extends SyntaxNode {
  kind: "Layout";
  body: (ModeStmt | PinSpacingStmt | GridNode)[];
}
export interface ModeStmt extends SyntaxNode { kind: "Mode"; value: LayoutMode }
/** `pin spacing N`: distance between neighbouring pins in grid units (≥ 1). */
export interface PinSpacingStmt extends SyntaxNode { kind: "PinSpacing"; value: number }
export interface GridNode extends SyntaxNode { kind: "Grid"; rows: GridRow[] }
export interface GridRow extends SyntaxNode { kind: "GridRow"; cells: GridCell[] }
/** `id` is missing for an empty cell (`.`). */
export interface GridCell extends SyntaxNode { kind: "GridCell"; id?: Ident }

export type GroupStmt = LabelStmt | SystemNode | ComponentNode;

export interface ZoneNode extends SyntaxNode {
  kind: "Zone";
  id: Ident;
  body: GroupStmt[];
}

export interface SystemNode extends SyntaxNode {
  kind: "System";
  id: Ident;
  body: GroupStmt[];
}

// ── Components ───────────────────────────────────────────────

export interface ComponentNode extends SyntaxNode {
  kind: "Component";
  id: Ident;
  template?: Ident;
  body?: ComponentStmt[];
}

export type ComponentStmt =
  | LabelStmt | SizeStmt | ImportanceStmt | CategoryStmt
  | PinStmt | SideBlock | HintStmt | CountStmt | MetaBlock;

export interface LabelStmt extends SyntaxNode { kind: "Label"; value: StringLit }
export interface SizeStmt extends SyntaxNode { kind: "Size"; value: Size }
export interface ImportanceStmt extends SyntaxNode { kind: "Importance"; value: Importance }
export interface CategoryStmt extends SyntaxNode { kind: "Category"; value: Ident }

export interface PinStmt extends SyntaxNode {
  kind: "Pin";
  signal: Ident;
  name: Ident;
  label?: StringLit;
}

export interface SideBlock extends SyntaxNode {
  kind: "SideBlock";
  side: Side;
  pins: PinStmt[];
}

/** Number of identical elements, rendered as stacked cards. */
export interface CountStmt extends SyntaxNode { kind: "Count"; value: number }

export interface HintStmt extends SyntaxNode {
  kind: "Hint";
  axis: "row" | "column";
  value: number;
}

export interface MetaBlock extends SyntaxNode {
  kind: "Meta";
  entries: MetaEntry[];
}
export interface MetaEntry extends SyntaxNode { kind: "MetaEntry"; key: Ident; value: StringLit }

// ── Connections ──────────────────────────────────────────────

export interface ConnectionNode extends SyntaxNode {
  kind: "Connection";
  from: EndpointNode;
  arrow: Arrow;
  to: EndpointNode;
  body?: (LabelStmt | TypeStmt)[];
}

export interface EndpointNode extends SyntaxNode {
  kind: "Endpoint";
  component: Ident;
  pin?: Ident;
}

export interface TypeStmt extends SyntaxNode { kind: "Type"; value: Ident }

// ── Templates ────────────────────────────────────────────────

export interface DefineNode extends SyntaxNode {
  kind: "Define";
  name: Ident;
  extends?: Ident;
  body: DefineStmt[];
}

export type DefineStmt =
  | LabelStmt | SizeStmt | CategoryStmt | ShapeStmt | IconStmt | PinStmt | SideBlock;

export interface ShapeStmt extends SyntaxNode { kind: "Shape"; value: Ident }
/** `icon none` removes an inherited icon. */
export interface IconStmt extends SyntaxNode { kind: "Icon"; value: Ident }
