import { copyFileSync, mkdirSync } from "node:fs";
import { builtinModules } from "node:module";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";

const root = fileURLToPath(new URL("../../", import.meta.url));
const src = (name) => `${root}packages/${name}/src/index.ts`;
const watch = process.argv.includes("--watch");

const context = await esbuild.context({
  entryPoints: [fileURLToPath(new URL("src/main.ts", import.meta.url))],
  outfile: fileURLToPath(new URL("dist/main.js", import.meta.url)),
  bundle: true,
  format: "cjs",
  platform: "browser",
  target: "es2022",
  // Obsidian provides these modules at runtime
  external: [
    "obsidian", "electron",
    "@codemirror/autocomplete", "@codemirror/collab", "@codemirror/commands", "@codemirror/language",
    "@codemirror/lint", "@codemirror/search", "@codemirror/state", "@codemirror/view",
    "@lezer/common", "@lezer/highlight", "@lezer/lr",
    ...builtinModules,
  ],
  // packages straight from the sources, as in Vite and Vitest
  alias: {
    "@sysarch/core": src("core"),
    "@sysarch/themes": src("themes"),
    "@sysarch/layout": src("layout"),
    "@sysarch/render-svg": src("render-svg"),
    "@sysarch/export-png": src("export-png"),
    "@sysarch/export-reactflow": src("export-reactflow"),
    "@sysarch/editor": src("editor"),
  },
  logLevel: "info",
  sourcemap: watch ? "inline" : false,
  minify: !watch,
  legalComments: "none",
});

if (watch) {
  await context.watch();
} else {
  await context.rebuild();
  await context.dispose();
}

// dist/ is an installable plugin folder: main.js, manifest.json, styles.css
mkdirSync(fileURLToPath(new URL("dist", import.meta.url)), { recursive: true });
for (const file of ["manifest.json", "styles.css"]) {
  copyFileSync(fileURLToPath(new URL(file, import.meta.url)), fileURLToPath(new URL(`dist/${file}`, import.meta.url)));
}
