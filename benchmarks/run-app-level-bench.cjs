const { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } = require("node:fs");
const { dirname, join, relative, resolve } = require("node:path");
const { performance } = require("node:perf_hooks");
const { spawnSync } = require("node:child_process");
const { pathToFileURL } = require("node:url");

const APPS = [
  { name: "todo", sourceDir: resolve("examples", "showcase", "todo", "pages") },
  { name: "dashboard", sourceDir: resolve("examples", "showcase", "dashboard", "pages") },
  { name: "landing", sourceDir: resolve("examples", "showcase", "landing", "pages") },
  { name: "core-pages", sourceDir: resolve("examples", "pages") },
  { name: "velox-web", sourceDir: resolve("apps", "velox-web") },
];

async function main() {
  const outRoot = resolve("benchmarks", "out");
  mkdirSync(outRoot, { recursive: true });

  const results = [];
  for (const app of APPS) {
    // eslint-disable-next-line no-await-in-loop
    const result = await runAppBenchmark(app, outRoot);
    results.push(result);
  }

  const summary = summarize(results);
  console.log(
    JSON.stringify(
      {
        benchmark: "app-level",
        runtime: process.version,
        apps: results,
        summary,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function runAppBenchmark(app, outRoot) {
  const outDir = join(outRoot, `app-${app.name}`);
  const mjsDir = join(outRoot, `app-${app.name}-mjs`);
  rmSync(outDir, { recursive: true, force: true });
  rmSync(mjsDir, { recursive: true, force: true });

  const buildStart = performance.now();
  const build = spawnSync(process.execPath, [resolve("dist", "cli.js"), "build", app.sourceDir, "-o", outDir], {
    encoding: "utf8",
  });
  const buildMs = performance.now() - buildStart;
  if (build.status !== 0) {
    throw new Error(
      `App benchmark build failed for ${app.name}\n` +
        `stdout:\n${build.stdout || ""}\n` +
        `stderr:\n${build.stderr || ""}`,
    );
  }

  const files = listFiles(outDir);
  const jsFiles = files.filter((file) => file.endsWith(".js"));
  const wasmFiles = files.filter((file) => file.endsWith(".wasm"));
  const cssFiles = files.filter((file) => file.endsWith(".css"));
  const totalBytes = files.reduce((acc, file) => acc + statSync(file).size, 0);

  mirrorJsToMjs(outDir, mjsDir, jsFiles);
  const manifest = readManifestIfPresent(outDir);
  const modulePaths = selectModulesForRenderBench(manifest, mjsDir, jsFiles, outDir);
  const runtime = await runRenderBench(modulePaths);

  return {
    app: app.name,
    sourceDir: app.sourceDir,
    buildMs: round(buildMs),
    routes: manifest && manifest.router ? manifest.router.routeCount : 0,
    files: {
      js: jsFiles.length,
      css: cssFiles.length,
      wasm: wasmFiles.length,
      total: files.length,
      totalBytes,
      totalKb: round(totalBytes / 1024),
    },
    runtime,
  };
}

function mirrorJsToMjs(outDir, mjsDir, jsFiles) {
  for (const jsFile of jsFiles) {
    const rel = relative(outDir, jsFile);
    const target = join(mjsDir, rel.replace(/\.js$/i, ".mjs"));
    mkdirSync(dirname(target), { recursive: true });
    let code = readFileSync(jsFile, "utf8");
    // Node ESM benchmark runtime cannot execute CSS side-effect imports.
    code = code.replace(/^\s*import\s+['"][^'"]+\.css['"];?\s*$/gm, "");
    code = code.replace(/from\s+(['"])(\.{1,2}\/[^'"]+?)\.js\1/g, "from $1$2.mjs$1");
    code = code.replace(/import\((['"])(\.{1,2}\/[^'"]+?)\.js\1\)/g, "import($1$2.mjs$1)");
    writeFileSync(target, code, "utf8");
  }
}

function selectModulesForRenderBench(manifest, mjsDir, jsFiles, outDir) {
  if (manifest && manifest.files && Array.isArray(manifest.files.modules) && manifest.files.modules.length > 0) {
    return manifest.files.modules
      .map((rel) => join(mjsDir, rel.replace(/\.js$/i, ".mjs")))
      .filter((file) => statSafe(file));
  }

  return jsFiles
    .map((file) => join(mjsDir, relative(outDir, file).replace(/\.js$/i, ".mjs")))
    .filter((file) => statSafe(file))
    .filter((file) => !file.endsWith("__velox_router.mjs"));
}

async function runRenderBench(modulePaths) {
  const renderFns = [];
  const loadStart = performance.now();
  for (const modulePath of modulePaths) {
    // eslint-disable-next-line no-await-in-loop
    const mod = await import(pathToFileURL(modulePath).href + `?t=${Date.now()}-${Math.random()}`);
    for (const value of Object.values(mod)) {
      if (typeof value !== "function") {
        continue;
      }
      try {
        const instance = value(...makeArgs(value.length));
        if (instance && typeof instance.render === "function") {
          renderFns.push(instance.render);
        }
      } catch {
        // Ignore non-component exports or functions requiring strict runtime args.
      }
    }
  }
  const moduleLoadMs = performance.now() - loadStart;

  if (renderFns.length === 0) {
    return {
      moduleLoadMs: round(moduleLoadMs),
      renderFns: 0,
      iterations: 0,
      renderMs: 0,
      rendersPerSecond: 0,
      outputCharCount: 0,
    };
  }

  let warmChars = 0;
  for (let i = 0; i < 100; i++) {
    for (const render of renderFns) {
      warmChars += String(render()).length;
    }
  }

  const iterations = 1200;
  let outputCharCount = 0;
  const renderStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    for (const render of renderFns) {
      outputCharCount += String(render()).length;
    }
  }
  const renderMs = performance.now() - renderStart;
  const totalRenders = iterations * renderFns.length;

  return {
    moduleLoadMs: round(moduleLoadMs),
    renderFns: renderFns.length,
    iterations,
    renderMs: round(renderMs),
    rendersPerSecond: round(totalRenders / (renderMs / 1000)),
    outputCharCount: outputCharCount + warmChars,
  };
}

function makeArgs(length) {
  const base = [
    "Velox",
    () => {},
    [1, 2, 3, 4, 5],
    { id: "demo", slug: "sample", title: "Demo" },
    { query: {}, params: {}, path: "/" },
  ];
  const args = [];
  for (let i = 0; i < length; i++) {
    args.push(base[i] !== undefined ? base[i] : null);
  }
  return args;
}

function readManifestIfPresent(outDir) {
  const file = join(outDir, "velox-manifest.json");
  if (!statSafe(file)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function summarize(results) {
  const avgBuildMs = avg(results.map((entry) => entry.buildMs));
  const avgRenderMs = avg(results.map((entry) => entry.runtime.renderMs));
  const avgRendersPerSecond = avg(results.map((entry) => entry.runtime.rendersPerSecond));
  const totalBundleKb = results.reduce((acc, entry) => acc + entry.files.totalKb, 0);
  return {
    appCount: results.length,
    avgBuildMs: round(avgBuildMs),
    avgRenderMs: round(avgRenderMs),
    avgRendersPerSecond: round(avgRendersPerSecond),
    totalBundleKb: round(totalBundleKb),
  };
}

function listFiles(root) {
  const out = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (entry.isFile()) {
        out.push(full);
      }
    }
  }
  out.sort();
  return out;
}

function avg(values) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function round(value) {
  return Number(value.toFixed(3));
}

function statSafe(file) {
  try {
    return statSync(file);
  } catch {
    return null;
  }
}
