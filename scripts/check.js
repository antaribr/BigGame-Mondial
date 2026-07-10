import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const files = [];
const ignored = new Set([".git", ".vercel", "node_modules", "public"]);

function walk(directory) {
  for (const name of readdirSync(directory)) {
    if (ignored.has(name)) continue;
    const path = join(directory, name);
    if (statSync(path).isDirectory()) walk(path);
    else files.push(path);
  }
}
walk(root);

const forbiddenExtensions = new Set([".ts", ".tsx", ".jsx", ".py", ".vue", ".svelte"]);
const forbidden = files.filter((file) => forbiddenExtensions.has(extname(file)));
if (forbidden.length) throw new Error(`Unsupported framework/source files found: ${forbidden.map((file) => relative(root, file)).join(", ")}`);

for (const file of files.filter((path) => path.endsWith(".js") && !path.includes(`${join("js", "vendor")}`))) {
  execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
  console.log(`✓ syntax ${relative(root, file)}`);
}

for (const name of ["config.json", "config.example.json", "manifest.json", "package.json", "vercel.json", "data/sample-questions.json"]) {
  JSON.parse(readFileSync(join(root, name), "utf8"));
  console.log(`✓ json ${name}`);
}

for (const name of ["index.html", "styles.css", "api/admin.js", "api/config.js", "api/quiz.js", "api/tasks.js", "data/BigGame-Quiz-Import-Template.xlsx", "supabase/schema.sql", "supabase/tasks-migration.sql"]) {
  if (!existsSync(join(root, name))) throw new Error(`Missing required file: ${name}`);
}

const html = readFileSync(join(root, "index.html"), "utf8");
for (const required of ["/styles.css", "/js/app.js", "id=\"app\""]) {
  if (!html.includes(required)) throw new Error(`index.html is missing ${required}`);
}

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
if (pkg.dependencies || pkg.devDependencies) throw new Error("This project must remain dependency-free.");

console.log(`\nAll checks passed (${files.length} source files, no framework dependencies).`);
