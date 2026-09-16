import type { PinStmt } from "../ast/index.js";
import { diagnostic, withSuggestion, type Diagnostic } from "../diagnostics/index.js";
import { SIGNAL_KINDS, isOneOf, type Side, type SignalKind, type Span } from "../types.js";

export interface PinDraft {
  name: string;
  label?: string;
  kind: SignalKind;
  side?: Side;
  sideSource?: "explicit" | "template";
  origin: Span;
  /** Im aktuell verarbeiteten Block deklariert (nicht geerbt). */
  declaredHere: boolean;
}

/** Signalart prüfen; unbekannte Arten melden `E109` und fallen auf `signal` zurück. */
export function signalKind(name: string, span: Span, diagnostics: Diagnostic[]): SignalKind {
  if (isOneOf(SIGNAL_KINDS, name)) return name;
  diagnostics.push(withSuggestion("E109", `Unbekannte Signalart \`${name}\``, name, span, SIGNAL_KINDS));
  return "signal";
}

/**
 * Fügt eine Pin-Deklaration an. Ein geerbter Pin gleicher Art darf neu deklariert werden,
 * um Seite oder Label zu ändern; er behält seine Position. Alles andere Doppelte ist `E105`.
 */
export function declarePin(
  pins: PinDraft[],
  stmt: PinStmt,
  side: Side | undefined,
  sideSource: "explicit" | "template",
  diagnostics: Diagnostic[],
): void {
  const kind = signalKind(stmt.signal.name, stmt.signal.span, diagnostics);
  const name = stmt.name.name;
  const existing = pins.find((p) => p.name === name);

  if (existing === undefined) {
    pins.push({
      name,
      ...(stmt.label && { label: stmt.label.value }),
      kind,
      ...(side && { side, sideSource }),
      origin: stmt.span,
      declaredHere: true,
    });
    return;
  }
  if (existing.declaredHere) {
    diagnostics.push(diagnostic("E105", `Pin \`${name}\` ist doppelt deklariert`, stmt.name.span));
    return;
  }
  if (existing.kind !== kind) {
    diagnostics.push(diagnostic(
      "E105",
      `Pin \`${name}\` ist im Template als \`${existing.kind}\` deklariert und kann nicht als \`${kind}\` neu deklariert werden`,
      stmt.signal.span,
    ));
    return;
  }
  existing.declaredHere = true;
  existing.origin = stmt.span;
  if (side) {
    existing.side = side;
    existing.sideSource = sideSource;
  }
  if (stmt.label) existing.label = stmt.label.value;
}
