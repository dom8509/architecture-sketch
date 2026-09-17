import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const root = fileURLToPath(new URL("../../", import.meta.url));
const src = (name: string) => `${root}packages/${name}/src/index.ts`;

export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@sysarch/core": src("core"),
      "@sysarch/themes": src("themes"),
      "@sysarch/layout": src("layout"),
      "@sysarch/render-svg": src("render-svg"),
      "@sysarch/export-reactflow": src("export-reactflow"),
    },
  },
  server: { fs: { allow: [root] } },
  build: { outDir: "dist", emptyOutDir: true, chunkSizeWarningLimit: 1200 },
});
