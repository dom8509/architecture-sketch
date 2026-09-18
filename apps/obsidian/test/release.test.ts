import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => JSON.parse(readFileSync(join(import.meta.dirname, "..", file), "utf8"));

describe("release files", () => {
  const manifest = read("manifest.json");

  it("the version in manifest.json, package.json and versions.json matches", () => {
    expect(manifest.version).toBe(read("package.json").version);
    expect(read("versions.json")[manifest.version]).toBe(manifest.minAppVersion);
  });

  it("manifest.json in the repository root is identical (BRAT reads it there)", () => {
    expect(read("../../manifest.json")).toEqual(manifest);
  });

  it("manifest.json has the required fields of a community plugin", () => {
    for (const key of ["id", "name", "version", "minAppVersion", "description", "author", "isDesktopOnly"]) {
      expect(manifest).toHaveProperty(key);
    }
    expect(manifest.id).not.toMatch(/obsidian/);
  });
});
