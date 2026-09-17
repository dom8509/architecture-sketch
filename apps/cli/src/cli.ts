import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { parseArgs } from "node:util";
import {
  compile, format, hasErrors, loadLibrary, standardLibrary, THEMES,
  type Diagnostic, type Severity,
} from "@sysarch/core";
import { renderArchitecture } from "@sysarch/render-svg";

export const VERSION = "0.1.0";

export interface Io {
  stdout(text: string): void;
  stderr(text: string): void;
}

/** Exit-Codes: 0 ok, 1 Diagnosen/Prüfung fehlgeschlagen, 2 Aufruf- oder Dateifehler. */
const OK = 0;
const FAILED = 1;
const USAGE = 2;

const HELP = `sysarch ${VERSION} — Architecture-as-Code für Systemarchitekturen

Aufruf:
  sysarch render <dateien…> [--out <verzeichnis|datei.svg|->] [--theme <name>] [--format svg]
  sysarch check  <dateien…> [--max-warnings <n>] [--format text|json] [--verbose]
  sysarch fmt    <dateien…> [--check]

Dateien:  .arch-Dateien (render) bzw. .arch/.archlib (check, fmt); Verzeichnisse werden
          rekursiv durchsucht. \`fmt -\` liest von stdin und schreibt nach stdout.

render    Rendert nach SVG. Ohne --out neben die Quelle, mit --out - nach stdout.
check     Meldet Diagnosen als datei:zeile:spalte: stufe CODE: meldung.
          Exit 1 bei Fehlern oder mehr Warnungen als --max-warnings.
          Hinweise (I…) nur mit --verbose bzw. immer im JSON-Format.
fmt       Formatiert in-place; --check meldet nur unformatierte Dateien (Exit 1).

Exit-Codes: 0 ok · 1 Diagnosen bzw. Prüfung fehlgeschlagen · 2 Aufruffehler
`;

class UsageError extends Error {}

/** Führt die CLI aus und liefert den Exit-Code. */
export function run(argv: readonly string[], io: Io): number {
  const [command, ...args] = argv;
  try {
    switch (command) {
      case "render": return render(args, io);
      case "check": return check(args, io);
      case "fmt": return fmt(args, io);
      case "--version": case "-v":
        io.stdout(VERSION + "\n");
        return OK;
      case undefined: case "help": case "--help": case "-h":
        io.stdout(HELP);
        return command === undefined ? USAGE : OK;
      default:
        throw new UsageError(`Unbekannter Befehl \`${command}\``);
    }
  } catch (e) {
    if (e instanceof UsageError || isArgError(e)) {
      io.stderr(`sysarch: ${(e as Error).message}\nHilfe: sysarch --help\n`);
      return USAGE;
    }
    throw e;
  }
}

const isArgError = (e: unknown) =>
  e instanceof TypeError && String((e as NodeJS.ErrnoException).code).startsWith("ERR_PARSE_ARGS");

// ── render ─────────────────────────────────────────────────────

function render(args: readonly string[], io: Io): number {
  const { values, positionals } = parseArgs({
    args: [...args],
    allowPositionals: true,
    options: {
      out: { type: "string", short: "o" },
      format: { type: "string", default: "svg" },
      theme: { type: "string" },
    },
  });
  if (values.format !== "svg") {
    const planned = ["png", "reactflow"].includes(values.format) ? " (geplant für M5)" : "";
    throw new UsageError(`Format \`${values.format}\` wird nicht unterstützt${planned}; verfügbar: svg`);
  }
  if (values.theme !== undefined && !THEMES.includes(values.theme)) {
    throw new UsageError(`Unbekanntes Theme \`${values.theme}\`; verfügbar: ${THEMES.join(", ")}`);
  }
  const files = expandInputs(positionals, [".arch"]);
  const out = values.out;
  const singleTarget = out === "-" || out?.endsWith(".svg");
  if (singleTarget && files.length !== 1) {
    throw new UsageError(`--out ${out} verlangt genau eine Eingabedatei, gefunden ${files.length}`);
  }

  let failed = false;
  const written = new Set<string>();
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const { value: model, diagnostics } = compile(source);
    printDiagnostics(io.stderr, file, diagnostics, false);
    if (hasErrors(diagnostics)) {
      failed = true;
      continue;
    }
    const svg = renderArchitecture(model, values.theme);
    if (out === "-") {
      io.stdout(svg);
      continue;
    }
    const target = singleTarget ? out! : join(out ?? dirname(file), basename(file, extname(file)) + ".svg");
    if (written.has(target)) throw new UsageError(`Mehrere Eingaben schreiben nach ${target}`);
    written.add(target);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, svg);
    io.stderr(`${file} → ${target}\n`);
  }
  return failed ? FAILED : OK;
}

// ── check ──────────────────────────────────────────────────────

function check(args: readonly string[], io: Io): number {
  const { values, positionals } = parseArgs({
    args: [...args],
    allowPositionals: true,
    options: {
      "max-warnings": { type: "string" },
      format: { type: "string", default: "text" },
      verbose: { type: "boolean", default: false },
    },
  });
  if (values.format !== "text" && values.format !== "json") {
    throw new UsageError(`Unbekanntes Ausgabeformat \`${values.format}\`; verfügbar: text, json`);
  }
  let maxWarnings: number | undefined;
  if (values["max-warnings"] !== undefined) {
    maxWarnings = Number(values["max-warnings"]);
    if (!Number.isInteger(maxWarnings) || maxWarnings < 0) {
      throw new UsageError(`--max-warnings erwartet eine Zahl ≥ 0, gefunden \`${values["max-warnings"]}\``);
    }
  }

  const files = expandInputs(positionals, [".arch", ".archlib"]);
  const count: Record<Severity, number> = { error: 0, warning: 0, info: 0 };
  const json: JsonDiagnostic[] = [];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const diagnostics = file.endsWith(".archlib")
      ? loadLibrary(source, [...standardLibrary().icons.values()]).diagnostics
      : compile(source).diagnostics;
    for (const d of diagnostics) count[d.severity]++;
    if (values.format === "json") json.push(...diagnostics.map((d) => toJson(file, source, d)));
    else printDiagnostics(io.stdout, file, diagnostics, values.verbose);
  }

  if (values.format === "json") io.stdout(JSON.stringify(json, null, 2) + "\n");
  const checked = files.length === 1 ? "1 Datei" : `${files.length} Dateien`;
  io.stderr(`${checked} geprüft: ${count.error} Fehler, ${count.warning} Warnungen, ${count.info} Hinweise\n`);
  const tooManyWarnings = maxWarnings !== undefined && count.warning > maxWarnings;
  if (tooManyWarnings) io.stderr(`Mehr als ${maxWarnings} Warnungen erlaubt\n`);
  return count.error > 0 || tooManyWarnings ? FAILED : OK;
}

// ── fmt ────────────────────────────────────────────────────────

function fmt(args: readonly string[], io: Io): number {
  const { values, positionals } = parseArgs({
    args: [...args],
    allowPositionals: true,
    options: { check: { type: "boolean", default: false } },
  });

  if (positionals.length === 1 && positionals[0] === "-") {
    const source = readFileSync(0, "utf8");
    const { value, diagnostics } = format(source);
    printDiagnostics(io.stderr, "<stdin>", diagnostics, false);
    if (hasErrors(diagnostics)) return FAILED;
    if (values.check) return value === source ? OK : FAILED;
    io.stdout(value);
    return OK;
  }

  let failed = false;
  let changed = 0;
  const files = expandInputs(positionals, [".arch", ".archlib"]);
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const { value, diagnostics } = format(source);
    if (hasErrors(diagnostics)) {
      printDiagnostics(io.stderr, file, diagnostics, false);
      failed = true;
      continue;
    }
    if (value === source) continue;
    changed++;
    if (values.check) {
      io.stdout(`${file}\n`);
      failed = true;
    } else {
      writeFileSync(file, value);
      io.stderr(`formatiert: ${file}\n`);
    }
  }
  if (values.check && changed > 0) {
    io.stderr(`${changed} von ${files.length} Dateien sind nicht formatiert — \`sysarch fmt\` ausführen\n`);
  }
  return failed ? FAILED : OK;
}

// ── Eingaben ───────────────────────────────────────────────────

/** Dateien direkt, Verzeichnisse rekursiv nach Endung (sortiert, ohne versteckte und node_modules). */
function expandInputs(inputs: readonly string[], extensions: readonly string[]): string[] {
  if (inputs.length === 0) throw new UsageError("Keine Eingabedateien angegeben");
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (extensions.includes(extname(entry.name))) files.push(path);
    }
  };
  for (const input of inputs) {
    if (!existsSync(input)) throw new UsageError(`Datei nicht gefunden: ${input}`);
    if (statSync(input).isDirectory()) {
      walk(input);
    } else if (extensions.includes(extname(input))) {
      files.push(input);
    } else {
      throw new UsageError(`Erwartet ${extensions.join(" oder ")}, gefunden ${input}`);
    }
  }
  if (files.length === 0) throw new UsageError(`Keine ${extensions.join("/")}-Dateien in ${inputs.join(", ")}`);
  return files;
}

// ── Diagnosen ──────────────────────────────────────────────────

interface JsonDiagnostic {
  file: string;
  code: string;
  severity: Severity;
  message: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  suggestions?: { label: string; replacement: string }[];
}

/** 1-basierte Zeile/Spalte eines Offsets. */
function position(source: string, offset: number): { line: number; column: number } {
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < offset && i < source.length; i++) {
    if (source[i] === "\n") {
      line++;
      lineStart = i + 1;
    }
  }
  return { line, column: offset - lineStart + 1 };
}

function toJson(file: string, source: string, d: Diagnostic): JsonDiagnostic {
  const end = position(source, d.span.end);
  const result: JsonDiagnostic = {
    file, code: d.code, severity: d.severity, message: d.message,
    line: d.span.line, column: d.span.column, endLine: end.line, endColumn: end.column,
  };
  if (d.suggestions) result.suggestions = d.suggestions.map(({ label, replacement }) => ({ label, replacement }));
  return result;
}

/** Compiler-Format `datei:zeile:spalte: error E103: …`, das Editoren und CI-Annotationen erkennen. */
function printDiagnostics(
  write: (text: string) => void,
  file: string,
  diagnostics: readonly Diagnostic[],
  includeInfos: boolean,
) {
  for (const d of diagnostics) {
    if (d.severity === "info" && !includeInfos) continue;
    write(`${file}:${d.span.line}:${d.span.column}: ${d.severity} ${d.code}: ${d.message}\n`);
  }
}
