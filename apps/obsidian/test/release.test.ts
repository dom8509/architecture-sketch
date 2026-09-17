import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => JSON.parse(readFileSync(join(import.meta.dirname, "..", file), "utf8"));

describe("Release-Dateien", () => {
  const manifest = read("manifest.json");

  it("Version in manifest.json, package.json und versions.json stimmt überein", () => {
    expect(manifest.version).toBe(read("package.json").version);
    expect(read("versions.json")[manifest.version]).toBe(manifest.minAppVersion);
  });

  it("manifest.json hat die Pflichtfelder eines Community-Plugins", () => {
    for (const key of ["id", "name", "version", "minAppVersion", "description", "author", "isDesktopOnly"]) {
      expect(manifest).toHaveProperty(key);
    }
    expect(manifest.id).not.toMatch(/obsidian/);
  });
});
