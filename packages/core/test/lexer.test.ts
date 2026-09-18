import { describe, expect, it } from "vitest";
import { lex } from "../src/index.js";

const types = (source: string) => lex(source).tokens.map((t) => (t.type === "ident" ? t.text : t.type));

describe("lex", () => {
  it("recognises operators and punctuation", () => {
    expect(types("a -> b <- c <-> d -- e . : | { }")).toEqual([
      "a", "->", "b", "<-", "c", "<->", "d", "--", "e", ".", ":", "|", "{", "}", "eof",
    ]);
  });

  it("allows `-` in identifiers only before a letter", () => {
    expect(types("automotive-light")).toEqual(["automotive-light", "eof"]);
    expect(types("a--b")).toEqual(["a", "--", "b", "eof"]);
    expect(types("a->b")).toEqual(["a", "->", "b", "eof"]);
    expect(types("x-1")).toEqual(["x", "invalid", "int", "eof"]);
  });

  it("resolves escapes in strings", () => {
    const [t] = lex(String.raw`"a \"b\" \\ c\nd"`).tokens;
    expect(t!.value).toBe('a "b" \\ c\nd');
  });

  it("reports unterminated strings and block comments", () => {
    expect(lex('"unterminated').diagnostics.map((d) => d.code)).toEqual(["E001"]);
    expect(lex("/* unterminated").diagnostics.map((d) => d.code)).toEqual(["E001"]);
    expect(lex(String.raw`"\q"`).diagnostics.map((d) => d.code)).toEqual(["E001"]);
  });

  it("attaches comments and blank lines as trivia to the following token", () => {
    const { tokens } = lex("a\n\n// comment\n/* block */ b");
    const b = tokens[1]!;
    expect(b.leadingTrivia.map((t) => t.kind)).toEqual(["blankLine", "comment", "comment"]);
    expect(b.leadingTrivia[1]!.text).toBe("// comment");
    expect(b.newlineBefore).toBe(true);
  });

  it("computes line, column and offsets", () => {
    const { tokens } = lex("a\n  bb");
    expect(tokens[1]!.span).toEqual({ start: 4, end: 6, line: 2, column: 3 });
  });

  it("reads integers", () => {
    expect(lex("42").tokens[0]).toMatchObject({ type: "int", text: "42" });
  });
});
