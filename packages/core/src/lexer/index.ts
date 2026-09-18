import type { Trivia } from "../ast/index.js";
import type { Span } from "../types.js";
import { diagnostic, type Diagnostic } from "../diagnostics/index.js";

export type TokenType =
  | "ident" | "string" | "int"
  | "->" | "<-" | "<->" | "--"
  | "." | ":" | "|" | "{" | "}"
  | "invalid" | "eof";

export interface Token {
  type: TokenType;
  /** Source text of the token; for strings the raw text including quotes. */
  text: string;
  /** Value after escape resolution (strings only). */
  value: string;
  span: Span;
  /** There is at least one line break between the previous token and this one. */
  newlineBefore: boolean;
  leadingTrivia: Trivia[];
}

export interface LexResult {
  tokens: Token[];
  diagnostics: Diagnostic[];
}

const isLetter = (c: string | undefined) => c !== undefined && /[A-Za-z]/.test(c);
const isIdentStart = (c: string | undefined) => c !== undefined && /[A-Za-z_]/.test(c);
const isIdentPart = (c: string | undefined) => c !== undefined && /[A-Za-z0-9_]/.test(c);
const isDigit = (c: string | undefined) => c !== undefined && c >= "0" && c <= "9";

/** Splits the source text into tokens. Comments and blank lines are attached as trivia to the following token. */
export function lex(source: string): LexResult {
  const tokens: Token[] = [];
  const diagnostics: Diagnostic[] = [];
  let pos = 0;
  let line = 1;
  let lineStart = 0;

  const spanFrom = (start: number, startLine: number, startColumn: number): Span => ({
    start,
    end: pos,
    line: startLine,
    column: startColumn,
  });

  let trivia: Trivia[] = [];
  let newlineBefore = false;
  /** Line breaks since the last token or comment — two make a blank line. */
  let newlinesInRun = 0;

  while (pos < source.length) {
    const c = source[pos]!;

    if (c === "\n") {
      newlinesInRun++;
      if (newlinesInRun === 2) {
        const span = { start: pos, end: pos + 1, line, column: pos - lineStart + 1 };
        trivia.push({ kind: "blankLine", text: "", span });
      }
      pos++;
      line++;
      lineStart = pos;
      newlineBefore = true;
      continue;
    }
    if (c === " " || c === "\t" || c === "\r") {
      pos++;
      continue;
    }

    const start = pos;
    const startLine = line;
    const startColumn = pos - lineStart + 1;

    // Comments
    if (c === "/" && source[pos + 1] === "/") {
      while (pos < source.length && source[pos] !== "\n") pos++;
      trivia.push({ kind: "comment", text: source.slice(start, pos), span: spanFrom(start, startLine, startColumn) });
      newlinesInRun = 0;
      continue;
    }
    if (c === "/" && source[pos + 1] === "*") {
      pos += 2;
      while (pos < source.length && !(source[pos] === "*" && source[pos + 1] === "/")) {
        if (source[pos] === "\n") {
          line++;
          lineStart = pos + 1;
          newlineBefore = true;
        }
        pos++;
      }
      if (pos >= source.length) {
        diagnostics.push(diagnostic("E001", "Unterminated block comment, expected `*/`", spanFrom(start, startLine, startColumn)));
      } else {
        pos += 2;
      }
      trivia.push({ kind: "comment", text: source.slice(start, pos), span: spanFrom(start, startLine, startColumn) });
      newlinesInRun = 0;
      continue;
    }

    let type: TokenType;
    let value = "";

    if (isIdentStart(c)) {
      pos++;
      while (isIdentPart(source[pos]) || (source[pos] === "-" && isLetter(source[pos + 1]))) pos++;
      type = "ident";
      value = source.slice(start, pos);
    } else if (isDigit(c)) {
      while (isDigit(source[pos])) pos++;
      type = "int";
      value = source.slice(start, pos);
    } else if (c === '"') {
      pos++;
      let closed = false;
      while (pos < source.length) {
        const ch = source[pos]!;
        if (ch === '"') {
          pos++;
          closed = true;
          break;
        }
        if (ch === "\n") break;
        if (ch === "\\") {
          const next = source[pos + 1];
          if (next === '"' || next === "\\") value += next;
          else if (next === "n") value += "\n";
          else {
            const escapeSpan = { start: pos, end: pos + 2, line, column: pos - lineStart + 1 };
            diagnostics.push(diagnostic("E001", `Unknown escape sequence \`\\${next ?? ""}\`, allowed are \\" \\\\ \\n`, escapeSpan));
            if (next !== undefined && next !== "\n") value += next;
          }
          pos += next === undefined || next === "\n" ? 1 : 2;
          continue;
        }
        value += ch;
        pos++;
      }
      type = "string";
      if (!closed) {
        diagnostics.push(diagnostic("E001", "Unterminated string, expected `\"`", spanFrom(start, startLine, startColumn)));
      }
    } else if (c === "-" && source[pos + 1] === ">") {
      pos += 2;
      type = "->";
    } else if (c === "-" && source[pos + 1] === "-") {
      pos += 2;
      type = "--";
    } else if (c === "<" && source[pos + 1] === "-" && source[pos + 2] === ">") {
      pos += 3;
      type = "<->";
    } else if (c === "<" && source[pos + 1] === "-") {
      pos += 2;
      type = "<-";
    } else if (c === "." || c === ":" || c === "|" || c === "{" || c === "}") {
      pos++;
      type = c;
    } else {
      pos++;
      // Reported only in the parser, so that skipped regions (e.g. reserved constructs) stay silent.
      type = "invalid";
    }

    tokens.push({
      type,
      text: source.slice(start, pos),
      value,
      span: spanFrom(start, startLine, startColumn),
      newlineBefore,
      leadingTrivia: trivia,
    });
    trivia = [];
    newlineBefore = false;
    newlinesInRun = 0;
  }

  const eofSpan = { start: pos, end: pos, line, column: pos - lineStart + 1 };
  tokens.push({ type: "eof", text: "", value: "", span: eofSpan, newlineBefore, leadingTrivia: trivia });
  return { tokens, diagnostics };
}
