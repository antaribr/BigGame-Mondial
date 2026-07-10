import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const output = join(root, "public");
const files = [
  "index.html",
  "styles.css",
  "favicon.svg",
  "manifest.json",
  "config.json",
];
const directories = ["js", "data"];

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });

for (const file of files) {
  cpSync(join(root, file), join(output, file));
}
for (const directory of directories) {
  cpSync(join(root, directory), join(output, directory), { recursive: true });
}

console.log(`Built framework-free static site in ${output}`);
