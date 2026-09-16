// Bereinigt library/icons/*.svg zu IconDefs und bettet sie zusammen mit
// library/automotive.archlib in @sysarch/core ein. Ein ungültiges Icon bricht den Build.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { IconError, convertIcon } from "../packages/core/src/library/icons.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const iconDir = join(root, "library", "icons");
const output = join(root, "packages", "core", "src", "library", "generated.ts");

const files = readdirSync(iconDir).filter((f) => f.endsWith(".svg")).sort();
const icons = [];
let failed = false;
for (const file of files) {
  const name = basename(file, ".svg");
  if (!/^[a-z][a-z0-9_]*$/.test(name)) {
    console.error(`library/icons/${file}: Dateiname muss ein gültiger Bezeichner sein (a-z, 0-9, _)`);
    failed = true;
    continue;
  }
  try {
    icons.push(convertIcon(name, readFileSync(join(iconDir, file), "utf8")));
  } catch (e) {
    if (!(e instanceof IconError)) throw e;
    console.error(`library/icons/${file}: ${e.message}`);
    failed = true;
  }
}
if (failed) process.exit(1);

const archlib = readFileSync(join(root, "library", "automotive.archlib"), "utf8");
writeFileSync(
  output,
  `// Generiert von scripts/build-icons.ts — nicht von Hand bearbeiten.\n` +
    `import type { IconDef } from "../resolve/library.js";\n\n` +
    `export const AUTOMOTIVE_ARCHLIB: string = ${JSON.stringify(archlib)};\n\n` +
    `export const ICONS: readonly IconDef[] = ${JSON.stringify(icons, null, 2)};\n`,
);
console.log(`${icons.length} Icons nach ${output.slice(root.length + 1)} geschrieben`);
