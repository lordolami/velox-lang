import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { normalizeFastScript, stripTypeScriptHints } from "./fs-normalize.mjs";

const APP_DIR = resolve("app");
const PAGE_DIR = join(APP_DIR, "pages");
const EXT_INPUT = new Set([".js", ".jsx", ".ts", ".tsx", ".fs"]);

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

function toFsPath(file) {
  return file.replace(/\.(js|jsx|ts|tsx)$/, ".fs");
}

function rewriteRelativeExt(source) {
  let out = source
    .replace(/from\s+["'](\.\/[^"']+)\.(js|jsx|ts|tsx)["']/g, 'from "$1.fs"')
    .replace(/from\s+["'](\.\.\/[^"']+)\.(js|jsx|ts|tsx)["']/g, 'from "$1.fs"')
    .replace(/import\(\s*["'](\.\/[^"']+)\.(js|jsx|ts|tsx)["']\s*\)/g, 'import("$1.fs")')
    .replace(/import\(\s*["'](\.\.\/[^"']+)\.(js|jsx|ts|tsx)["']\s*\)/g, 'import("$1.fs")');

  out = out
    .replace(/require\(\s*["'](\.\/[^"']+)\.(js|jsx|ts|tsx)["']\s*\)/g, 'require("$1.fs")')
    .replace(/require\(\s*["'](\.\.\/[^"']+)\.(js|jsx|ts|tsx)["']\s*\)/g, 'require("$1.fs")');

  out = out
    .replace(/module\.exports\s*=\s*/g, "export default ")
    .replace(/exports\.([A-Za-z_$][\w$]*)\s*=\s*/g, "export const $1 = ");

  return out;
}

export async function runMigrate(target = "app/pages") {
  const base = resolve(target);
  if (!existsSync(base)) throw new Error(`Missing path: ${base}`);

  const files = walk(base).filter((f) => EXT_INPUT.has(extname(f)));
  let migrated = 0;
  let kept = 0;

  for (const file of files) {
    const ext = extname(file);
    const raw = readFileSync(file, "utf8");
    let next = raw;

    if (ext === ".ts" || ext === ".tsx") next = stripTypeScriptHints(next);
    next = normalizeFastScript(next);
    next = rewriteRelativeExt(next);

    const out = ext === ".fs" ? file : toFsPath(file);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, next, "utf8");

    if (out !== file) {
      rmSync(file, { force: true });
      migrated += 1;
    } else {
      kept += 1;
    }
  }

  if (base === PAGE_DIR) {
    if (!existsSync(join(PAGE_DIR, "index.fs")) && existsSync(join(PAGE_DIR, "index.js"))) {
      const source = readFileSync(join(PAGE_DIR, "index.js"), "utf8");
      writeFileSync(join(PAGE_DIR, "index.fs"), normalizeFastScript(source), "utf8");
      rmSync(join(PAGE_DIR, "index.js"), { force: true });
      migrated += 1;
    }
  }

  console.log(`migrate complete: ${migrated} converted, ${kept} already .fs`);
}
