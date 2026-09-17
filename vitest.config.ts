import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = (name: string) => fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@sysarch/core": src("core"),
      "@sysarch/themes": src("themes"),
      "@sysarch/layout": src("layout"),
      "@sysarch/render-svg": src("render-svg"),
      "@sysarch/export-reactflow": src("export-reactflow"),
      "@sysarch/export-png": src("export-png"),
      "@sysarch/editor": src("editor"),
    },
  },
  test: {
    include: ["packages/*/test/**/*.test.ts", "apps/*/test/**/*.test.ts"],
  },
});
