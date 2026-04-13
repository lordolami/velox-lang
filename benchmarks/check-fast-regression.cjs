const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { spawnSync } = require("node:child_process");

function main() {
  const baseline = JSON.parse(readFileSync(resolve("benchmarks", "fast-baseline.json"), "utf8"));
  const run = spawnSync(process.execPath, [resolve("benchmarks", "run-fast-vs-js.cjs")], {
    encoding: "utf8",
  });

  if (run.status !== 0) {
    process.stderr.write(run.stderr || run.stdout || "bench:fast failed\n");
    process.exit(run.status || 1);
  }

  const payload = parseJson(run.stdout);
  const summary = payload.summary || {};
  const cases = Array.isArray(payload.cases) ? payload.cases : [];
  const failures = [];

  const averageSpeedup = Number(summary.averageSpeedup || 0);
  const worstSpeedup = Number(summary.worstSpeedup || 0);
  const passingCases = cases.filter((entry) => Number(entry.speedup || 0) >= baseline.minCaseSpeedup).length;

  if (averageSpeedup < baseline.minAverageSpeedup) {
    failures.push(
      `summary: averageSpeedup ${averageSpeedup} < ${baseline.minAverageSpeedup}`,
    );
  }
  if (worstSpeedup < baseline.minWorstSpeedup) {
    failures.push(`summary: worstSpeedup ${worstSpeedup} < ${baseline.minWorstSpeedup}`);
  }
  if (passingCases < baseline.minPassingCases) {
    failures.push(`cases: passingCases ${passingCases} < ${baseline.minPassingCases}`);
  }

  const result = {
    benchmark: "fast-regression-gate",
    pass: failures.length === 0,
    failures,
    measured: {
      averageSpeedup,
      worstSpeedup,
      passingCases,
      totalCases: cases.length,
    },
  };
  console.log(JSON.stringify(result, null, 2));

  if (failures.length > 0) {
    process.exit(1);
  }
}

function parseJson(stdout) {
  const start = stdout.indexOf("{");
  if (start === -1) {
    throw new Error(`Unable to parse benchmark JSON from output:\n${stdout}`);
  }
  return JSON.parse(stdout.slice(start));
}

main();
