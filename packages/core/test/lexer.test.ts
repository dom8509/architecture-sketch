import { describe, expect, it } from "vitest";
import { lex } from "../src/index.js";

const types = (source: string) => lex(source).tokens.map((t) => (t.type === "ident" ? t.text : t.type));

describe("lex", () => {
  it("erkennt Operatoren und Satzzeichen", () => {
    expect(types("a -> b <- c <-> d -- e . : | { }")).toEqual([
      "a", "->", "b", "<-", "c", "<->", "d", "--", "e", ".", ":", "|", "{", "}", "eof",
    ]);
  });

  it("erlaubt `-` in Bezeichnern nur vor einem Buchstaben", () => {
    expect(types("automotive-light")).toEqual(["automotive-light", "eof"]);
    expect(types("a--b")).toEqual(["a", "--", "b", "eof"]);
    expect(types("a->b")).toEqual(["a", "->", "b", "eof"]);
    expect(types("x-1")).toEqual(["x", "invalid", "int", "eof"]);
  });

  it("löst Escapes in Strings auf", () => {
    const [t] = lex(String.raw`"a \"b\" \\ c\nd"`).tokens;
    expect(t!.value).toBe('a "b" \\ c\nd');
  });

  it("meldet offene Strings und Blockkommentare", () => {
    expect(lex('"offen').diagnostics.map((d) => d.code)).toEqual(["E001"]);
    expect(lex("/* offen").diagnostics.map((d) => d.code)).toEqual(["E001"]);
    expect(lex(String.raw`"\q"`).diagnostics.map((d) => d.code)).toEqual(["E001"]);
  });

  it("hängt Kommentare und Leerzeilen als Trivia an das Folgetoken", () => {
    const { tokens } = lex("a\n\n// Kommentar\n/* Block */ b");
    const b = tokens[1]!;
    expect(b.leadingTrivia.map((t) => t.kind)).toEqual(["blankLine", "comment", "comment"]);
    expect(b.leadingTrivia[1]!.text).toBe("// Kommentar");
    expect(b.newlineBefore).toBe(true);
  });

  it("berechnet Zeile, Spalte und Offsets", () => {
    const { tokens } = lex("a\n  bb");
    expect(tokens[1]!.span).toEqual({ start: 4, end: 6, line: 2, column: 3 });
  });

  it("liest Ganzzahlen", () => {
    expect(lex("42").tokens[0]).toMatchObject({ type: "int", text: "42" });
  });
});
