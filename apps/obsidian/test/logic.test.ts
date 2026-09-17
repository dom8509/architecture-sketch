import { compile, format, hasErrors, standardLibrary } from "@sysarch/core";
import { describe, expect, it } from "vitest";
import {
  componentSnippet, effectiveTheme, exportBaseName, libraryGroups, NEW_SOURCE, replaceBlock, templatePreviewSource,
} from "../src/logic.js";

describe("NEW_SOURCE", () => {
  it("ist fehlerfrei, formatiert und folgt dem Obsidian-Modus", () => {
    expect(compile(NEW_SOURCE).diagnostics).toEqual([]);
    expect(format(NEW_SOURCE).value).toBe(NEW_SOURCE);
    expect(effectiveTheme(NEW_SOURCE, "auto", true)).toBe("automotive-dark");
  });
});

describe("effectiveTheme", () => {
  const plain = `architecture "A" {\n    component mcu: microcontroller\n}\n`;

  it("folgt ohne theme dem Obsidian-Modus", () => {
    expect(effectiveTheme(plain, "auto", false)).toBe("automotive-light");
    expect(effectiveTheme(plain, "auto", true)).toBe("automotive-dark");
  });

  it("nimmt ein festes Theme aus den Einstellungen", () => {
    expect(effectiveTheme(plain, "technical", true)).toBe("technical");
  });

  it("lässt ein theme in der Quelle gewinnen", () => {
    const source = `architecture "A" {\n    theme presentation\n    component mcu: microcontroller\n}\n`;
    expect(effectiveTheme(source, "auto", true)).toBeUndefined();
    expect(effectiveTheme(source, "technical", false)).toBeUndefined();
  });
});

describe("exportBaseName", () => {
  it("bildet einen Slug aus dem Titel", () => {
    expect(exportBaseName("Door ECU", "Notiz")).toBe("door-ecu");
    expect(exportBaseName("Zonen-Steuergerät (vorne) ", "Notiz")).toBe("zonen-steuergerät-vorne");
  });

  it("fällt auf den Notiznamen zurück", () => {
    expect(exportBaseName("", "Meine Notiz")).toBe("Meine Notiz");
    expect(exportBaseName("—", "")).toBe("architektur");
  });
});

describe("replaceBlock", () => {
  const note = ["# Titel", "", "```sysarch", "architecture \"A\" {", "}", "```", "", "Text"].join("\n");
  const expected = "architecture \"A\" {\n}\n";

  it("ersetzt genau den Inhalt zwischen den Zäunen", () => {
    const result = replaceBlock(note, 2, 5, expected, "architecture \"B\" {\n    direction TB\n}\n");
    expect(result).toBe(["# Titel", "", "```sysarch", "architecture \"B\" {", "    direction TB", "}", "```", "", "Text"].join("\n"));
  });

  it("überschreibt nichts, wenn sich der Block geändert hat", () => {
    expect(replaceBlock(note, 2, 5, "architecture \"X\" {\n}", "neu")).toBeUndefined();
    expect(replaceBlock(note, 0, 5, expected, "neu")).toBeUndefined();
    expect(replaceBlock(note, 2, 9, expected, "neu")).toBeUndefined();
  });

  it("behält CRLF-Zeilenenden bei", () => {
    const crlf = note.replace(/\n/g, "\r\n");
    expect(replaceBlock(crlf, 2, 5, expected, "architecture \"B\" {\n}")).toBe(
      ["# Titel", "", "```sysarch", "architecture \"B\" {", "}", "```", "", "Text"].join("\r\n"),
    );
  });
});

describe("Bibliothek", () => {
  const library = standardLibrary();

  it("zeigt jedes Template genau einmal, gruppiert nach Kategorie", () => {
    const names = libraryGroups(library).flatMap((g) => g.templates.map((t) => t.name));
    expect(names.sort()).toEqual([...library.templates.keys()].sort());
  });

  it("filtert über Name, Label und Pins", () => {
    const names = (query: string) => libraryGroups(library, query).flatMap((g) => g.templates.map((t) => t.name));
    expect(names("CANH")).toEqual(["can_transceiver"]);
    expect(names("Battery")).toContain("battery");
    expect(libraryGroups(library, "gibt-es-nicht")).toEqual([]);
  });

  it("rendert für jedes Template eine fehlerfreie Vorschau", () => {
    for (const template of library.templates.values()) {
      expect(hasErrors(compile(templatePreviewSource(template)).diagnostics), template.name).toBe(false);
      expect(compile(`architecture "A" {\n    ${componentSnippet(template)}\n}\n`).diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    }
  });
});
