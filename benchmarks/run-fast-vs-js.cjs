const { copyFileSync, mkdirSync } = require("node:fs");
const { resolve, dirname } = require("node:path");
const { execSync } = require("node:child_process");
const { performance } = require("node:perf_hooks");
const { pathToFileURL } = require("node:url");

function jsSumTo(n) {
  let i = 0;
  let acc = 0;
  while (i < n) {
    acc += i;
    i += 1;
  }
  return acc;
}

async function main() {
  const outDir = resolve("benchmarks", "out");
  mkdirSync(outDir, { recursive: true });

  const suite = [];
  suite.push(
    await runCase({
      name: "sumTo(n) with internal loop",
      sourceFile: "fast-sum.vx",
      exportName: "sumTo",
      iterations: 30_000,
      n: 3_000,
      jsImpl: jsSumTo,
    }),
  );
  suite.push(
    await runCase({
      name: "multiAccum(n) multi-register kernel",
      sourceFile: "fast-multiaccum.vx",
      exportName: "multiAccum",
      iterations: 16_000,
      n: 7_000,
      jsImpl: jsMultiAccum,
    }),
  );
  suite.push(
    await runCase({
      name: "arithSeries(n) dual accumulator kernel",
      sourceFile: "fast-arith.vx",
      exportName: "arithSeries",
      iterations: 20_000,
      n: 6_000,
      jsImpl: jsArithSeries,
    }),
  );

  const speedups = suite.map((entry) => entry.speedup);
  const avg = speedups.reduce((a, b) => a + b, 0) / speedups.length;
  const best = Math.max(...speedups);
  const worst = Math.min(...speedups);
  console.log(
    JSON.stringify(
      {
        runtime: process.version,
        cases: suite,
        summary: {
          averageSpeedup: Number(avg.toFixed(3)),
          bestSpeedup: Number(best.toFixed(3)),
          worstSpeedup: Number(worst.toFixed(3)),
        },
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

async function runCase(input) {
  const source = resolve("benchmarks", input.sourceFile);
  const base = input.sourceFile.replace(/\.vx$/, "");
  const outJs = resolve("benchmarks", "out", `${base}.js`);
  const outMjs = resolve("benchmarks", "out", `${base}.mjs`);

  execSync(`node dist/cli.js build "${source}" -o "${outJs}"`, { stdio: "inherit" });
  copyFileSync(outJs, outMjs);

  const mod = await import(pathToFileURL(outMjs).href + `?t=${Date.now()}`);
  const wasmImpl = mod[input.exportName];
  if (typeof wasmImpl !== "function") {
    throw new Error(`Expected exported ${input.exportName} function from generated module.`);
  }

  let warm = 0;
  for (let i = 0; i < 1_500; i++) {
    warm += input.jsImpl(input.n);
    warm += wasmImpl(input.n);
  }

  let jsResult = 0;
  const jsStart = performance.now();
  for (let i = 0; i < input.iterations; i++) {
    jsResult += input.jsImpl(input.n);
  }
  const jsMs = performance.now() - jsStart;

  let wasmResult = 0;
  const wasmStart = performance.now();
  for (let i = 0; i < input.iterations; i++) {
    wasmResult += wasmImpl(input.n);
  }
  const wasmMs = performance.now() - wasmStart;

  if (jsResult !== wasmResult) {
    throw new Error(`Result mismatch in ${input.name}: js=${jsResult}, wasm=${wasmResult}`);
  }

  return {
    benchmark: input.name,
    iterations: input.iterations,
    n: input.n,
    jsMs: Number(jsMs.toFixed(3)),
    wasmMs: Number(wasmMs.toFixed(3)),
    speedup: Number((jsMs / wasmMs).toFixed(3)),
    result: jsResult,
    warm,
  };
}

function jsMix(n) {
  let i = 0;
  let acc = 0;
  while (i < n) {
    acc = acc + (i * i) % 97;
    acc = acc + (i % 7);
    i += 1;
  }
  return acc;
}

function jsArithSeries(n) {
  let i = 0;
  let a = 0;
  let b = 0;
  while (i < n) {
    a = a + i;
    b = b + (i * 3);
    i += 1;
  }
  return a + b;
}

function jsMultiAccum(n) {
  let i = 1;
  let a = 0;
  let b = 1;
  let c = 2;
  while (i < n) {
    a = a + (i * 5);
    b = b + (i * 7);
    c = c + (i * 11);
    i += 1;
  }
  return a + b + c;
}
