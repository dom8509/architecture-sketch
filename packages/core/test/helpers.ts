import { compile, type Diagnostic } from "../src/index.js";

/** Diagnostics without hints (I…), compactly as "CODE line:column". */
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

/** Wraps statements in an architecture. */
export function arch(body: string, prelude = ""): string {
  return `${prelude}\narchitecture "Test" {\n${body}\n}\n`;
}
