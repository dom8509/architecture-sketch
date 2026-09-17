/** Quellbereich, 0-basierte Offsets, 1-basierte Zeile/Spalte für Meldungen. */
export interface Span {
  start: number;
  end: number;
  line: number;
  column: number;
}

export type Direction = "LR" | "TB";
export type Side = "left" | "right" | "top" | "bottom";
export type Size = "small" | "medium" | "large";
export type Importance = "primary" | "secondary";
export type LayoutMode = "strict" | "assisted";
/** Welche Pins gezeichnet werden: alle, nur verbundene, keine. */
export type PinDisplay = "all" | "connected" | "none";
/** Gleich verschaltete Komponenten automatisch zu einem Stapel zusammenfassen? */
export type StackMode = "none" | "identical";
export type Arrow = "->" | "<-" | "<->" | "--";

export type SignalKind =
  | "power" | "ground"
  | "signal" | "digital" | "analog" | "pwm"
  | "bus" | "can" | "lin" | "spi" | "i2c" | "uart" | "ethernet"
  | "diagnostic" | "debug";

export type SignalGroup = "supply" | "single" | "bus" | "diagnostic";

export type Shape = "rounded" | "rect" | "circle" | "hexagon" | "cylinder";

export type Category =
  | "power" | "controller" | "communication" | "sensor"
  | "actuator" | "software" | "external" | "generic";

export const SIDES: readonly Side[] = ["left", "right", "top", "bottom"];
export const SIZES: readonly Size[] = ["small", "medium", "large"];
export const IMPORTANCES: readonly Importance[] = ["primary", "secondary"];
export const DIRECTIONS: readonly Direction[] = ["LR", "TB"];
export const LAYOUT_MODES: readonly LayoutMode[] = ["strict", "assisted"];
export const PIN_DISPLAYS: readonly PinDisplay[] = ["all", "connected", "none"];
export const STACK_MODES: readonly StackMode[] = ["none", "identical"];
export const SHAPES: readonly Shape[] = ["rounded", "rect", "circle", "hexagon", "cylinder"];
export const CATEGORIES: readonly Category[] = [
  "power", "controller", "communication", "sensor",
  "actuator", "software", "external", "generic",
];

export const SIGNAL_GROUPS: Readonly<Record<SignalKind, SignalGroup>> = {
  power: "supply",
  ground: "supply",
  signal: "single",
  digital: "single",
  analog: "single",
  pwm: "single",
  bus: "bus",
  can: "bus",
  lin: "bus",
  spi: "bus",
  i2c: "bus",
  uart: "bus",
  ethernet: "bus",
  diagnostic: "diagnostic",
  debug: "diagnostic",
};

export const SIGNAL_KINDS = Object.keys(SIGNAL_GROUPS) as SignalKind[];

/** Themes aus v0.1 (05-rendering-export.md). Die Token selbst liegen in @sysarch/themes. */
export const THEMES: readonly string[] = [
  "automotive-light", "automotive-dark", "presentation", "technical",
];

export function isOneOf<T extends string>(values: readonly T[], value: string): value is T {
  return (values as readonly string[]).includes(value);
}
