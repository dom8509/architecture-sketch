import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const root = fileURLToPath(new URL("../../", import.meta.url));
const src = (name: string) => `${root}packages/${name}/src/index.ts`;

export default defineConfig({
  // relative paths: the built site runs from any directory and from GitHub Pages
  base: "./",
  resolve: {
    alias: {
      "@sysarch/core": src("core"),
      "@sysarch/themes": src("themes"),
      "@sysarch/layout": src("layout"),
      "@sysarch/render-svg": src("render-svg"),
      "@sysarch/export-png": src("export-png"),
      "@sysarch/export-reactflow": src("export-reactflow"),
      "@sysarch/editor": src("editor"),
    },
  },
  server: { fs: { allow: [root] } },
  // ~800 kB, most of it glyphs of the embedded font subset
  build: { outDir: "dist", emptyOutDir: true, chunkSizeWarningLimit: 1200 },
});
