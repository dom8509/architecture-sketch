import type { Category, Importance, SignalGroup, Size } from "@sysarch/core";
import type { FontWeight } from "./metrics.js";

export interface TextStyle {
  size: number;
  weight: FontWeight;
  color: string;
}

export interface LineStyle {
  width: number;
  color: string;
  /** Gestrichelt. */
  dash?: number[];
  /** Doppellinie für Busse: `width` ist die Gesamtbreite, innen bleibt ein Drittel frei. */
  double?: boolean;
  endMarker: "arrow" | "ground" | "none";
}

export interface CategoryColors {
  fill: string;
  border: string;
  text: string;
}

/** Design-Tokens. Nur Themes kennen Pixel und Farben (D3, D20). */
export interface Theme {
  name: string;
  canvas: { background: string; padding: number };
  typography: {
    /** Muss in den Font-Metriken vorhanden sein. */
    fontFamily: string;
    title: TextStyle;
    component: TextStyle;
    componentPrimary: TextStyle;
    /** Farbe wird durch die Textfarbe der Kategorie ersetzt. */
    pin: TextStyle;
    connection: TextStyle;
    group: TextStyle;
  };
  spacing: {
    /** Alle Koordinaten von Komponenten, Pins und Pfaden sind Vielfache davon. */
    grid: number;
    nodeGapMain: number;
    nodeGapCross: number;
    zoneGap: number;
    pinPitch: number;
    groupPadding: number;
  };
  component: {
    radius: number;
    borderWidth: Record<Importance, number>;
    padding: number;
    minWidth: Record<Size, number>;
    minHeight: Record<Size, number>;
  };
  categories: Record<Category, CategoryColors>;
  icon: {
    size: Record<Size, number>;
    gap: number;
    /** Strichstärke im 24×24-Raster des Icons. */
    strokeWidth: number;
  };
  lines: Record<SignalGroup, LineStyle>;
  /** Kantenlängen der Marker in px; `hop` = Radius der Brücke, mit der eine Leitung eine andere überspringt. */
  markers: { arrow: number; ground: number; pin: number; hop: number };
  zone: { fill: string; border: string };
  system: { border: string; width: number; radius: number; dash?: number[] };
}

const FONT = "Inter";

const automotiveLight: Theme = {
  name: "automotive-light",
  canvas: { background: "#FFFFFF", padding: 32 },
  typography: {
    fontFamily: FONT,
    title: { size: 18, weight: 600, color: "#111827" },
    component: { size: 13, weight: 500, color: "#111827" },
    componentPrimary: { size: 14, weight: 600, color: "#111827" },
    pin: { size: 11, weight: 400, color: "#374151" },
    connection: { size: 11, weight: 500, color: "#374151" },
    group: { size: 12, weight: 600, color: "#4B5563" },
  },
  spacing: { grid: 16, nodeGapMain: 64, nodeGapCross: 32, zoneGap: 64, pinPitch: 16, groupPadding: 16 },
  component: {
    radius: 8,
    borderWidth: { primary: 2, secondary: 1 },
    padding: 8,
    minWidth: { small: 96, medium: 160, large: 208 },
    minHeight: { small: 48, medium: 64, large: 96 },
  },
  categories: {
    power: { fill: "#FFF4D6", border: "#D69E00", text: "#3D2E00" },
    controller: { fill: "#EAF2FF", border: "#316BD6", text: "#0F2A5C" },
    communication: { fill: "#E7F7EF", border: "#23875B", text: "#0D3B26" },
    sensor: { fill: "#F3EDFF", border: "#7B4FD1", text: "#2E1766" },
    actuator: { fill: "#FFEDE5", border: "#D2602A", text: "#4A1B06" },
    software: { fill: "#E6F6F8", border: "#1F8A9A", text: "#0A3940" },
    external: { fill: "#F1F2F4", border: "#6B7280", text: "#1F2937" },
    generic: { fill: "#FFFFFF", border: "#8A94A6", text: "#1F2937" },
  },
  icon: { size: { small: 16, medium: 20, large: 24 }, gap: 8, strokeWidth: 2 },
  lines: {
    supply: { width: 2.5, color: "#8A6100", endMarker: "arrow" },
    single: { width: 1.5, color: "#334155", endMarker: "arrow" },
    bus: { width: 4.5, color: "#1D5FBF", double: true, endMarker: "arrow" },
    diagnostic: { width: 1.5, color: "#6D28D9", dash: [6, 4], endMarker: "arrow" },
  },
  markers: { arrow: 8, ground: 12, pin: 6, hop: 5 },
  zone: { fill: "#F6F7F9", border: "#E3E6EB" },
  system: { border: "#8A94A6", width: 1, radius: 10, dash: [5, 3] },
};

const automotiveDark: Theme = {
  ...automotiveLight,
  name: "automotive-dark",
  canvas: { background: "#111418", padding: 32 },
  typography: {
    fontFamily: FONT,
    title: { size: 18, weight: 600, color: "#F3F4F6" },
    component: { size: 13, weight: 500, color: "#F3F4F6" },
    componentPrimary: { size: 14, weight: 600, color: "#F3F4F6" },
    pin: { size: 11, weight: 400, color: "#D1D5DB" },
    connection: { size: 11, weight: 500, color: "#D1D5DB" },
    group: { size: 12, weight: 600, color: "#AEB5C0" },
  },
  categories: {
    power: { fill: "#3A2E0A", border: "#E0B040", text: "#FCEBC0" },
    controller: { fill: "#13284A", border: "#6FA0F0", text: "#DCE8FF" },
    communication: { fill: "#0F3325", border: "#4CC38A", text: "#D5F5E6" },
    sensor: { fill: "#2A1D4D", border: "#A788F0", text: "#EAE0FF" },
    actuator: { fill: "#45200F", border: "#F08A55", text: "#FFE3D5" },
    software: { fill: "#0C3238", border: "#4CC3D3", text: "#D3F4F8" },
    external: { fill: "#23272E", border: "#9AA3AF", text: "#E5E7EB" },
    generic: { fill: "#1A1E24", border: "#7E8796", text: "#E5E7EB" },
  },
  lines: {
    supply: { width: 2.5, color: "#E0B040", endMarker: "arrow" },
    single: { width: 1.5, color: "#C3CAD5", endMarker: "arrow" },
    bus: { width: 4.5, color: "#6FA0F0", double: true, endMarker: "arrow" },
    diagnostic: { width: 1.5, color: "#B79BF5", dash: [6, 4], endMarker: "arrow" },
  },
  zone: { fill: "#181C22", border: "#272C34" },
  system: { border: "#7E8796", width: 1, radius: 10, dash: [5, 3] },
};

const presentation: Theme = {
  ...automotiveLight,
  name: "presentation",
  canvas: { background: "#FFFFFF", padding: 48 },
  typography: {
    fontFamily: FONT,
    title: { size: 26, weight: 600, color: "#111827" },
    component: { size: 17, weight: 500, color: "#111827" },
    componentPrimary: { size: 18, weight: 600, color: "#111827" },
    pin: { size: 13, weight: 400, color: "#374151" },
    connection: { size: 14, weight: 500, color: "#374151" },
    group: { size: 15, weight: 600, color: "#4B5563" },
  },
  spacing: { grid: 24, nodeGapMain: 96, nodeGapCross: 48, zoneGap: 96, pinPitch: 24, groupPadding: 24 },
  component: {
    radius: 12,
    borderWidth: { primary: 3, secondary: 2 },
    padding: 12,
    minWidth: { small: 144, medium: 216, large: 288 },
    minHeight: { small: 72, medium: 96, large: 144 },
  },
  icon: { size: { small: 22, medium: 26, large: 32 }, gap: 10, strokeWidth: 2.25 },
  lines: {
    supply: { width: 4, color: "#8A6100", endMarker: "arrow" },
    single: { width: 2.5, color: "#334155", endMarker: "arrow" },
    bus: { width: 7, color: "#1D5FBF", double: true, endMarker: "arrow" },
    diagnostic: { width: 2.5, color: "#6D28D9", dash: [9, 6], endMarker: "arrow" },
  },
  markers: { arrow: 12, ground: 18, pin: 9, hop: 8 },
  system: { border: "#6B7280", width: 2, radius: 14, dash: [8, 5] },
};

const INK = "#000000";
const PAPER = "#FFFFFF";
const mono: CategoryColors = { fill: PAPER, border: INK, text: INK };

/** Schwarz-weiß: Signalgruppen unterscheiden sich nur über Stärke, Muster und Marker. */
const technical: Theme = {
  ...automotiveLight,
  name: "technical",
  canvas: { background: PAPER, padding: 32 },
  typography: {
    fontFamily: FONT,
    title: { size: 18, weight: 600, color: INK },
    component: { size: 13, weight: 500, color: INK },
    componentPrimary: { size: 14, weight: 600, color: INK },
    pin: { size: 11, weight: 400, color: INK },
    connection: { size: 11, weight: 500, color: INK },
    group: { size: 12, weight: 600, color: INK },
  },
  categories: {
    power: mono, controller: mono, communication: mono, sensor: mono,
    actuator: mono, software: mono, external: mono, generic: mono,
  },
  lines: {
    supply: { width: 2.5, color: INK, endMarker: "arrow" },
    single: { width: 1.25, color: INK, endMarker: "arrow" },
    bus: { width: 4.5, color: INK, double: true, endMarker: "arrow" },
    diagnostic: { width: 1.25, color: INK, dash: [4, 3], endMarker: "arrow" },
  },
  zone: { fill: "#F5F5F5", border: "#BDBDBD" },
  system: { border: INK, width: 1, radius: 0, dash: [5, 3] },
};

export const themes: Readonly<Record<string, Theme>> = {
  "automotive-light": automotiveLight,
  "automotive-dark": automotiveDark,
  presentation,
  technical,
};

/** Theme nach Name; unbekannte Namen fallen auf `automotive-light` zurück (E109 meldet der Resolver). */
export function getTheme(name: string): Theme {
  return themes[name] ?? automotiveLight;
}
