import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import esbuild from "esbuild";
import { normalizeFastScript } from "./fs-normalize.mjs";

const TMP_DIR = resolve(".fastscript-tmp-compat");

function fsLoaderPlugin() {
  return {
    name: "fastscript-fs-loader",
    setup(build) {
      build.onLoad({ filter: /\.fs$/ }, async (args) => {
        const { readFile } = await import("node:fs/promises");
        const raw = await readFile(args.path, "utf8");
        return { contents: normalizeFastScript(raw), loader: "js" };
      });
    },
  };
}

async function bundle(entry) {
  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    platform: "browser",
    format: "esm",
    write: false,
    logLevel: "silent",
    plugins: [fsLoaderPlugin()],
    loader: { ".fs": "js" },
    resolveExtensions: [".fs", ".js", ".mjs", ".cjs", ".json"],
  });
}

export async function runCompat() {
  rmSync(TMP_DIR, { recursive: true, force: true });
  mkdirSync(TMP_DIR, { recursive: true });

  // CJS fixture
  writeFileSync(
    join(TMP_DIR, "cjs-lib.cjs"),
    `module.exports = { answer: 42, greet(name){ return "hi " + name; } };`,
    "utf8",
  );

  // ESM fixture
  writeFileSync(
    join(TMP_DIR, "esm-lib.js"),
    `export const value = 7; export default function twice(n){ return n*2; }`,
    "utf8",
  );

  // FS fixture using lenient syntax + mixed imports.
  writeFileSync(
    join(TMP_DIR, "entry.fs"),
    `import cjs from "./cjs-lib.cjs"
import twice, { value } from "./esm-lib.js"

state name = "fastscript"
fn run(n) {
  return cjs.greet(name) + ":" + String(twice(n) + value + cjs.answer)
}

export default run
`,
    "utf8",
  );

  // JS fixture importing FS module.
  writeFileSync(
    join(TMP_DIR, "entry-js.js"),
    `import run from "./entry.fs"; export default run(1);`,
    "utf8",
  );

  // Dynamic import + JSON compatibility fixture.
  writeFileSync(join(TMP_DIR, "data.json"), JSON.stringify({ ok: true, n: 3 }), "utf8");
  writeFileSync(
    join(TMP_DIR, "dynamic.js"),
    `export async function getN(){ const mod = await import("./data.json"); return mod.default.n; }`,
    "utf8",
  );
  writeFileSync(
    join(TMP_DIR, "dynamic-entry.fs"),
    `fn boot() { return "ok" }
export async function run() {
  const mod = await import("./dynamic.js");
  return mod.getN();
}
export default boot
`,
    "utf8",
  );

  // TS-like migrated syntax fixture.
  writeFileSync(
    join(TMP_DIR, "ts-like.fs"),
    `state total = 0
fn add(n) { total = total + n; return total }
export default add
`,
    "utf8",
  );

  const checks = [
    { name: "fs-entry-bundle", entry: join(TMP_DIR, "entry.fs") },
    { name: "js-imports-fs-bundle", entry: join(TMP_DIR, "entry-js.js") },
    { name: "dynamic-json-import-bundle", entry: join(TMP_DIR, "dynamic-entry.fs") },
    { name: "ts-like-fs-bundle", entry: join(TMP_DIR, "ts-like.fs") },
  ];

  for (const check of checks) {
    try {
      await bundle(check.entry);
      console.log(`compat pass: ${check.name}`);
    } catch (error) {
      throw new Error(`compat fail: ${check.name}\n${error.message}`);
    }
  }

  console.log("compat summary: core ESM/CJS/FS interop checks passed");
}
