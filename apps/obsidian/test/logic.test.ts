import { compile, format, hasErrors, standardLibrary } from "@sysarch/core";
import { describe, expect, it } from "vitest";
import {
  componentSnippet, effectiveTheme, exportBaseName, libraryGroups, NEW_SOURCE, replaceBlock, templatePreviewSource,
} from "../src/logic.js";

describe("NEW_SOURCE", () => {
  it("is error-free, formatted and follows the Obsidian mode", () => {
    expect(compile(NEW_SOURCE).diagnostics).toEqual([]);
    expect(format(NEW_SOURCE).value).toBe(NEW_SOURCE);
    expect(effectiveTheme(NEW_SOURCE, "auto", true)).toBe("automotive-dark");
  });
});

describe("effectiveTheme", () => {
  const plain = `architecture "A" {\n    component mcu: microcontroller\n}\n`;

  it("follows the Obsidian mode without a theme", () => {
    expect(effectiveTheme(plain, "auto", false)).toBe("automotive-light");
    expect(effectiveTheme(plain, "auto", true)).toBe("automotive-dark");
  });

  it("takes a fixed theme from the settings", () => {
    expect(effectiveTheme(plain, "technical", true)).toBe("technical");
  });

  it("lets a theme in the source win", () => {
    const source = `architecture "A" {\n    theme presentation\n    component mcu: microcontroller\n}\n`;
    expect(effectiveTheme(source, "auto", true)).toBeUndefined();
    expect(effectiveTheme(source, "technical", false)).toBeUndefined();
  });
});

describe("exportBaseName", () => {
  it("builds a slug from the title", () => {
    expect(exportBaseName("Door ECU", "Note")).toBe("door-ecu");
    expect(exportBaseName("Zone ECU (front) ", "Note")).toBe("zone-ecu-front");
  });

  it("falls back to the note name", () => {
    expect(exportBaseName("", "My note")).toBe("My note");
    expect(exportBaseName("—", "")).toBe("architecture");
  });
});

describe("replaceBlock", () => {
  const note = ["# Title", "", "```sysarch", "architecture \"A\" {", "}", "```", "", "Text"].join("\n");
  const expected = "architecture \"A\" {\n}\n";

  it("replaces exactly the content between the fences", () => {
    const result = replaceBlock(note, 2, 5, expected, "architecture \"B\" {\n    direction TB\n}\n");
    expect(result).toBe(["# Title", "", "```sysarch", "architecture \"B\" {", "    direction TB", "}", "```", "", "Text"].join("\n"));
  });

  it("overwrites nothing when the block changed", () => {
    expect(replaceBlock(note, 2, 5, "architecture \"X\" {\n}", "new")).toBeUndefined();
    expect(replaceBlock(note, 0, 5, expected, "new")).toBeUndefined();
    expect(replaceBlock(note, 2, 9, expected, "new")).toBeUndefined();
  });

  it("keeps CRLF line endings", () => {
    const crlf = note.replace(/\n/g, "\r\n");
    expect(replaceBlock(crlf, 2, 5, expected, "architecture \"B\" {\n}")).toBe(
      ["# Title", "", "```sysarch", "architecture \"B\" {", "}", "```", "", "Text"].join("\r\n"),
    );
  });
});

describe("library", () => {
  const library = standardLibrary();

  it("shows every template exactly once, grouped by category", () => {
    const names = libraryGroups(library).flatMap((g) => g.templates.map((t) => t.name));
    expect(names.sort()).toEqual([...library.templates.keys()].sort());
  });

  it("filters over name, label and pins", () => {
    const names = (query: string) => libraryGroups(library, query).flatMap((g) => g.templates.map((t) => t.name));
    expect(names("CANH")).toEqual(["can_transceiver"]);
    expect(names("Battery")).toContain("battery");
    expect(libraryGroups(library, "does-not-exist")).toEqual([]);
  });

  it("renders an error-free preview for every template", () => {
    for (const template of library.templates.values()) {
      expect(hasErrors(compile(templatePreviewSource(template)).diagnostics), template.name).toBe(false);
      expect(compile(`architecture "A" {\n    ${componentSnippet(template)}\n}\n`).diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    }
  });
});
