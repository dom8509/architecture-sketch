import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "@sysarch/core";
import { getTheme, type Theme } from "@sysarch/themes";
import { layout, type SceneGraph } from "../src/index.js";

export const root = fileURLToPath(new URL("../../../", import.meta.url));

export interface Example {
  name: string;
  source: string;
}

export function examples(): Example[] {
  const dir = join(root, "examples");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".arch"))
    .sort()
    .map((f) => ({ name: basename(f, ".arch"), source: readFileSync(join(dir, f), "utf8") }));
}

export function render(source: string, theme?: Theme): SceneGraph {
  const { value, diagnostics } = compile(source);
  const errors = diagnostics.filter((d) => d.severity === "error");
  if (errors.length) throw new Error(errors.map((d) => `${d.code} ${d.message}`).join("\n"));
  return layout(value, theme ?? getTheme(value.theme));
}

/** Stellt die Flussrichtung um (grid und hint bleiben Bildkoordinaten). */
export function withDirection(source: string, direction: "LR" | "TB"): string {
  return source.replace(/direction (LR|TB)/, `direction ${direction}`);
}

/** Fügt eine unverbundene Komponente am Ende ein — in der letzten Zone, falls Zonen verwendet werden. */
export function appendUnconnected(source: string): string {
  const component = "        component stability_probe { label \"Nachtrag\" }\n";
  const zone = [...source.matchAll(/\n\s*zone \w+ \{/g)].pop();
  let at: number;
  if (zone) {
    let depth = 0;
    at = source.indexOf("{", zone.index!);
    for (let i = at; i < source.length; i++) {
      if (source[i] === "{") depth++;
      else if (source[i] === "}" && --depth === 0) {
        at = i;
        break;
      }
    }
    return source.slice(0, at) + component + "    " + source.slice(at);
  }
  at = source.lastIndexOf("}");
  return source.slice(0, at) + component + source.slice(at);
}
