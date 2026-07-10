import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("../", import.meta.url).pathname;
const files = [];
function walk(directory) {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) walk(path);
    else files.push(path);
  }
}
walk(join(root, "js"));
walk(join(root, "supabase", "functions"));

for (const file of files.filter((path) => path.endsWith(".js") && !path.includes("/vendor/"))) {
  execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
  console.log(`✓ syntax ${relative(root, file)}`);
}
for (const name of ["config.json", "config.example.json", "manifest.json", "package.json", "data/sample-questions.json"]) {
  JSON.parse(readFileSync(join(root, name), "utf8"));
  console.log(`✓ json ${name}`);
}
const html = readFileSync(join(root, "index.html"), "utf8");
for (const required of ["/styles.css", "/js/app.js", "id=\"app\""]) {
  if (!html.includes(required)) throw new Error(`index.html is missing ${required}`);
}
console.log("✓ required HTML references");
console.log(`\nAll checks passed (${files.filter((path) => path.endsWith(".js") && !path.includes("/vendor/")).length} JavaScript files).`);
