import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { normalizeFastScript } from "./fs-normalize.mjs";

const VALID_TARGETS = new Set(["js", "ts"]);

function walk(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

function rewriteImportsForTarget(source, to) {
  let out = source
    .replace(/from\s+["'](\.\/[^"']+)\.fs["']/g, `from "$1.${to}"`)
    .replace(/from\s+["'](\.\.\/[^"']+)\.fs["']/g, `from "$1.${to}"`)
    .replace(/import\(\s*["'](\.\/[^"']+)\.fs["']\s*\)/g, `import("$1.${to}")`)
    .replace(/import\(\s*["'](\.\.\/[^"']+)\.fs["']\s*\)/g, `import("$1.${to}")`);
  out = out
    .replace(/require\(\s*["'](\.\/[^"']+)\.fs["']\s*\)/g, `require("$1.${to}")`)
    .replace(/require\(\s*["'](\.\.\/[^"']+)\.fs["']\s*\)/g, `require("$1.${to}")`);
  return out;
}

function toTargetPath(file, to) {
  if (extname(file) === ".fs") return file.replace(/\.fs$/, `.${to}`);
  return file;
}

export async function runExport(args = []) {
  let to = "js";
  let out = "exported-app";

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--to") to = (args[i + 1] || "").toLowerCase();
    if (arg === "--out") out = args[i + 1] || out;
  }

  if (!VALID_TARGETS.has(to)) {
    throw new Error('Invalid export target. Use: fastscript export --to js|ts');
  }

  const appDir = resolve("app");
  const outDir = resolve(out);
  if (!existsSync(appDir)) throw new Error("Missing app directory.");

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  // Copy non-page assets/directories first.
  for (const entry of readdirSync(appDir, { withFileTypes: true })) {
    if (entry.name === "pages") continue;
    const src = join(appDir, entry.name);
    const dest = join(outDir, entry.name);
    if (entry.isDirectory()) cpSync(src, dest, { recursive: true });
    else cpSync(src, dest);
  }

  const pageRoot = join(appDir, "pages");
  const pageFiles = walk(pageRoot);
  for (const file of pageFiles) {
    const rel = relative(appDir, file);
    const nextPath = toTargetPath(rel, to);
    const outFile = join(outDir, nextPath);
    mkdirSync(dirname(outFile), { recursive: true });

    const ext = extname(file);
    let source = readFileSync(file, "utf8");
    if (ext === ".fs") source = normalizeFastScript(source);
    source = rewriteImportsForTarget(source, to);
    if (to === "ts") source = `// @ts-nocheck\n${source}`;

    writeFileSync(outFile, source, "utf8");
  }

  console.log(`export complete: app -> ${out} (target: ${to})`);
}
