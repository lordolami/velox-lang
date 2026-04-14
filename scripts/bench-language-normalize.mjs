import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { compileFastScriptSource } from "../src/language-spec.mjs";

function makeFixture(lines = 6000) {
  const out = [];
  for (let i = 0; i < lines; i += 1) {
    if (i % 5 === 0) out.push(`~r_${i} = ${i}`);
    else if (i % 7 === 0) out.push(`state s_${i} = "${i}"`);
    else if (i % 11 === 0) out.push(`fn f_${i}(a, b) { return a + b + ${i} }`);
    else out.push(`const k_${i} = ${i}`);
  }
  return out.join("\n");
}

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length)));
  return sorted[idx];
}

const runs = [];
const fixture = makeFixture();
for (let i = 0; i < 20; i += 1) {
  const out = compileFastScriptSource(fixture, { filename: "bench.fs", strict: false });
  runs.push(out.stats.durationMs);
}

const result = {
  generatedAt: new Date().toISOString(),
  target: "Lenient Parser & Normalizer",
  sampleRuns: runs.length,
  p50Ms: Number(percentile(runs, 50).toFixed(3)),
  p95Ms: Number(percentile(runs, 95).toFixed(3)),
  maxMs: Number(Math.max(...runs).toFixed(3)),
  budgetMs: {
    p50: 12,
    p95: 25,
    max: 40,
  },
};

const benchDir = resolve("benchmarks");
mkdirSync(benchDir, { recursive: true });
writeFileSync(resolve("benchmarks/language-normalize-baseline.json"), JSON.stringify(result, null, 2), "utf8");
writeFileSync(
  resolve("benchmarks/language-normalize-baseline.md"),
  [
    "# Language Normalizer Baseline",
    "",
    `Generated: ${result.generatedAt}`,
    "",
    `- Target: ${result.target}`,
    `- Runs: ${result.sampleRuns}`,
    `- p50: ${result.p50Ms}ms (budget <= ${result.budgetMs.p50}ms)`,
    `- p95: ${result.p95Ms}ms (budget <= ${result.budgetMs.p95}ms)`,
    `- max: ${result.maxMs}ms (budget <= ${result.budgetMs.max}ms)`,
    "",
  ].join("\n"),
  "utf8",
);

console.log("bench-language-normalize complete");

