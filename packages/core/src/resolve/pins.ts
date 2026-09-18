import type { PinStmt, ShowStmt } from "../ast/index.js";
import { diagnostic, withSuggestion, type Diagnostic } from "../diagnostics/index.js";
import { SIGNAL_KINDS, isOneOf, type Side, type SignalKind, type Span } from "../types.js";

export interface PinDraft {
  name: string;
  label?: string;
  kind: SignalKind;
  side?: Side;
  sideSource?: "explicit" | "template";
  /** `show in …` statements of the pin; validated by the resolver. */
  views?: ShowStmt[];
  origin: Span;
  /** Declared in the block currently being processed (not inherited). */
  declaredHere: boolean;
}

/** Validates a signal kind; unknown kinds report `E109` and fall back to `signal`. */
export function signalKind(name: string, span: Span, diagnostics: Diagnostic[]): SignalKind {
  if (isOneOf(SIGNAL_KINDS, name)) return name;
  diagnostics.push(withSuggestion("E109", `Unknown signal kind \`${name}\``, name, span, SIGNAL_KINDS));
  return "signal";
}

/**
 * Adds a pin declaration. An inherited pin of the same kind may be redeclared to change its
 * side or label; it keeps its position. Any other duplicate is `E105`.
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
      ...(stmt.body?.length && { views: stmt.body }),
      origin: stmt.span,
      declaredHere: true,
    });
    return;
  }
  if (existing.declaredHere) {
    diagnostics.push(diagnostic("E105", `Pin \`${name}\` is declared twice`, stmt.name.span));
    return;
  }
  if (existing.kind !== kind) {
    diagnostics.push(diagnostic(
      "E105",
      `Pin \`${name}\` is declared as \`${existing.kind}\` in the template and cannot be redeclared as \`${kind}\``,
      stmt.signal.span,
    ));
    return;
  }
  existing.declaredHere = true;
  existing.origin = stmt.span;
  if (stmt.body?.length) existing.views = [...(existing.views ?? []), ...stmt.body];
  if (side) {
    existing.side = side;
    existing.sideSource = sideSource;
  }
  if (stmt.label) existing.label = stmt.label.value;
}
