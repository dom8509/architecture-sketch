import { compile, type Diagnostic } from "../src/index.js";

/** Diagnosen ohne Hinweise (I…), kompakt als "CODE zeile:spalte". */
export function problems(source: string): string[] {
  return compile(source)
    .diagnostics.filter((d) => d.severity !== "info")
    .map(format);
}

export function codes(source: string): string[] {
  return compile(source).diagnostics.map((d) => d.code);
}

export function format(d: Diagnostic): string {
  return `${d.code} ${d.span.line}:${d.span.column}`;
}

/** Umschließt Anweisungen mit einer Architektur. */
export function arch(body: string, prelude = ""): string {
  return `${prelude}\narchitecture "Test" {\n${body}\n}\n`;
}
