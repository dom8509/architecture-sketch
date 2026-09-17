import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const root = fileURLToPath(new URL("../../", import.meta.url));
const src = (name: string) => `${root}packages/${name}/src/index.ts`;

export default defineConfig({
  // relative Pfade: die gebaute Seite läuft aus jedem Verzeichnis und von GitHub Pages
  base: "./",
  resolve: {
    alias: {
      "@sysarch/core": src("core"),
      "@sysarch/themes": src("themes"),
      "@sysarch/layout": src("layout"),
      "@sysarch/render-svg": src("render-svg"),
      "@sysarch/editor": src("editor"),
    },
  },
  server: { fs: { allow: [root] } },
  // ~800 kB, davon der Großteil Glyphen des eingebetteten Schrift-Subsets
  build: { outDir: "dist", emptyOutDir: true, chunkSizeWarningLimit: 1200 },
});
