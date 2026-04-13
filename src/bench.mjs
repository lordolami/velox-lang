import { existsSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join, resolve } from "node:path";

const DIST = resolve("dist");
const JS_BUDGET_BYTES = 30 * 1024;
const CSS_BUDGET_BYTES = 10 * 1024;

function gzipSize(path) {
  if (!existsSync(path)) return 0;
  const raw = readFileSync(path);
  return gzipSync(raw, { level: 9 }).byteLength;
}

function kb(bytes) {
  return `${(bytes / 1024).toFixed(2)}KB`;
}

export async function runBench() {
  const manifestPath = join(DIST, "fastscript-manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error("Missing dist build output. Run: fastscript build");
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const jsAssets = [join(DIST, "router.js")];
  const cssAssets = [join(DIST, "styles.css")];

  if (manifest.layout) jsAssets.push(join(DIST, manifest.layout.replace(/^\.\//, "")));
  const root = manifest.routes.find((r) => r.path === "/");
  if (root?.module) jsAssets.push(join(DIST, root.module.replace(/^\.\//, "")));

  const totalJs = jsAssets.reduce((sum, p) => sum + gzipSize(p), 0);
  const totalCss = cssAssets.reduce((sum, p) => sum + gzipSize(p), 0);

  console.log(`3G budget check -> JS: ${kb(totalJs)} / 30.00KB, CSS: ${kb(totalCss)} / 10.00KB`);

  const errors = [];
  if (totalJs > JS_BUDGET_BYTES) errors.push(`JS budget exceeded by ${kb(totalJs - JS_BUDGET_BYTES)}`);
  if (totalCss > CSS_BUDGET_BYTES) errors.push(`CSS budget exceeded by ${kb(totalCss - CSS_BUDGET_BYTES)}`);

  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }
}

