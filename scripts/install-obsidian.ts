// Copies the built Obsidian plugin into a vault: npm run obsidian:install -- <vault>
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const vault = process.argv[2];
if (!vault || !existsSync(join(vault, ".obsidian"))) {
  console.error("Usage: npm run obsidian:install -- <path to vault>  (folder containing .obsidian/)");
  process.exit(2);
}

const dist = resolve(import.meta.dirname, "..", "apps", "obsidian", "dist");
const target = join(vault, ".obsidian", "plugins", "sysarch");
mkdirSync(target, { recursive: true });
for (const file of ["main.js", "manifest.json", "styles.css"]) copyFileSync(join(dist, file), join(target, file));
console.log(`sysarch copied to ${target} — enable or reload it under Community plugins in Obsidian.`);
