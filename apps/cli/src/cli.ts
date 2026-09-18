import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { parseArgs } from "node:util";
import {
  compile, format, hasErrors, loadLibrary, projectView, standardLibrary, THEMES,
  type ArchitectureModel, type Diagnostic, type Severity,
} from "@sysarch/core";
import { toReactFlow } from "@sysarch/export-reactflow";
import { architectureScene, renderSvg } from "@sysarch/render-svg";
import { renderPng } from "./png.js";

export const VERSION = "0.1.0";

export interface Io {
  stdout(text: string): void;
  stderr(text: string): void;
}

/** Exit codes: 0 ok, 1 diagnostics/check failed, 2 usage or file error. */
const OK = 0;
const FAILED = 1;
const USAGE = 2;

const HELP = `sysarch ${VERSION} — Architecture-as-Code for system architectures

Usage:
  sysarch render <files…> [--out <directory|file|->] [--theme <name>]
                 [--format svg|png|reactflow] [--scale 1|2|3] [--view <name>]
  sysarch check  <files…> [--max-warnings <n>] [--format text|json] [--verbose]
  sysarch fmt    <files…> [--check]

Files:    .arch files (render) or .arch/.archlib (check, fmt); directories are
          searched recursively. \`fmt -\` reads from stdin and writes to stdout.

render    Renders to SVG (.svg), PNG (.png, default --scale 2) or React Flow JSON
          (.reactflow.json). Without --out next to the source, with --out - to stdout
          (not for PNG). A document with \`view\` declarations renders one file per view
          (architecture-overview.svg); --view <name> picks a single one.
check     Reports diagnostics as file:line:column: severity CODE: message.
          Exit 1 on errors or on more warnings than --max-warnings.
          Infos (I…) only with --verbose, always in the JSON format.
fmt       Formats in place; --check only reports unformatted files (exit 1).

Exit codes: 0 ok · 1 diagnostics or check failed · 2 usage error
`;

class UsageError extends Error {}

/** Runs the CLI and returns the exit code. */
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
        throw new UsageError(`Unknown command \`${command}\``);
    }
  } catch (e) {
    if (e instanceof UsageError || isArgError(e)) {
      io.stderr(`sysarch: ${(e as Error).message}\nHelp: sysarch --help\n`);
      return USAGE;
    }
    throw e;
  }
}

const isArgError = (e: unknown) =>
  e instanceof TypeError && String((e as NodeJS.ErrnoException).code).startsWith("ERR_PARSE_ARGS");

// ── render ─────────────────────────────────────────────────────

const EXTENSIONS = { svg: ".svg", png: ".png", reactflow: ".reactflow.json" } as const;
type OutputFormat = keyof typeof EXTENSIONS;

function render(args: readonly string[], io: Io): number {
  const { values, positionals } = parseArgs({
    args: [...args],
    allowPositionals: true,
    options: {
      out: { type: "string", short: "o" },
      format: { type: "string", default: "svg" },
      theme: { type: "string" },
      scale: { type: "string" },
      view: { type: "string" },
    },
  });
  const outputFormat = values.format as OutputFormat;
  if (!Object.hasOwn(EXTENSIONS, outputFormat)) {
    throw new UsageError(`Format \`${values.format}\` is not supported; available: ${Object.keys(EXTENSIONS).join(", ")}`);
  }
  let scale = 2;
  if (values.scale !== undefined) {
    if (outputFormat !== "png") throw new UsageError("--scale only applies to --format png");
    scale = Number(values.scale);
    if (![1, 2, 3].includes(scale)) throw new UsageError(`--scale expects 1, 2 or 3, found \`${values.scale}\``);
  }
  if (values.theme !== undefined && !THEMES.includes(values.theme)) {
    throw new UsageError(`Unknown theme \`${values.theme}\`; available: ${THEMES.join(", ")}`);
  }
  const extension = EXTENSIONS[outputFormat];
  const files = expandInputs(positionals, [".arch"]);
  const out = values.out;
  if (out === "-" && outputFormat === "png") throw new UsageError("PNG cannot be written to stdout; pass --out <file.png>");
  const singleTarget = out === "-" || out?.endsWith(extension);
  if (singleTarget && files.length !== 1) {
    throw new UsageError(`--out ${out} requires exactly one input file, found ${files.length}`);
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
    if (values.view !== undefined && !model.views.some((v) => v.id === values.view)) {
      const known = model.views.map((v) => v.id).join(", ");
      throw new UsageError(known
        ? `${file} does not declare the view \`${values.view}\`; available: ${known}`
        : `${file} declares no views, so --view ${values.view} cannot be rendered`);
    }
    // One output per view, unless a single view is requested or the document declares none.
    const views: (string | undefined)[] = values.view !== undefined ? [values.view]
      : model.views.length > 0 ? model.views.map((v) => v.id)
      : [undefined];
    if (singleTarget && views.length > 1) {
      throw new UsageError(`--out ${out} requires a single diagram; pass --view <${model.views.map((v) => v.id).join("|")}>`);
    }

    for (const view of views) {
      const output = renderModel(view === undefined ? model : projectView(model, view));
      if (out === "-") {
        io.stdout(output as string);
        continue;
      }
      const suffix = view === undefined ? "" : `-${view}`;
      const target = singleTarget ? out!
        : join(out ?? dirname(file), basename(file, extname(file)) + suffix + extension);
      if (written.has(target)) throw new UsageError(`Several inputs write to ${target}`);
      written.add(target);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, output);
      io.stderr(`${file} → ${target}\n`);
    }
  }
  return failed ? FAILED : OK;

  function renderModel(model: ArchitectureModel): string | Uint8Array {
    const scene = architectureScene(model, values.theme);
    return outputFormat === "png" ? renderPng(scene, scale)
      : outputFormat === "reactflow" ? JSON.stringify(toReactFlow(model, scene), null, 2) + "\n"
      : renderSvg(scene);
  }
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
    throw new UsageError(`Unknown output format \`${values.format}\`; available: text, json`);
  }
  let maxWarnings: number | undefined;
  if (values["max-warnings"] !== undefined) {
    maxWarnings = Number(values["max-warnings"]);
    if (!Number.isInteger(maxWarnings) || maxWarnings < 0) {
      throw new UsageError(`--max-warnings expects a number ≥ 0, found \`${values["max-warnings"]}\``);
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
  const checked = files.length === 1 ? "1 file" : `${files.length} files`;
  io.stderr(`${checked} checked: ${count.error} errors, ${count.warning} warnings, ${count.info} infos\n`);
  const tooManyWarnings = maxWarnings !== undefined && count.warning > maxWarnings;
  if (tooManyWarnings) io.stderr(`More than ${maxWarnings} warnings allowed\n`);
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
      io.stderr(`formatted: ${file}\n`);
    }
  }
  if (values.check && changed > 0) {
    io.stderr(`${changed} of ${files.length} files are not formatted — run \`sysarch fmt\`\n`);
  }
  return failed ? FAILED : OK;
}

// ── inputs ─────────────────────────────────────────────────────

/** Files directly, directories recursively by extension (sorted, skipping hidden entries and node_modules). */
function expandInputs(inputs: readonly string[], extensions: readonly string[]): string[] {
  if (inputs.length === 0) throw new UsageError("No input files given");
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
    if (!existsSync(input)) throw new UsageError(`File not found: ${input}`);
    if (statSync(input).isDirectory()) {
      walk(input);
    } else if (extensions.includes(extname(input))) {
      files.push(input);
    } else {
      throw new UsageError(`Expected ${extensions.join(" or ")}, found ${input}`);
    }
  }
  if (files.length === 0) throw new UsageError(`No ${extensions.join("/")} files in ${inputs.join(", ")}`);
  return files;
}

// ── diagnostics ────────────────────────────────────────────────

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

/** 1-based line/column of an offset. */
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

/** Compiler format `file:line:column: error E103: …` that editors and CI annotations recognise. */
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
