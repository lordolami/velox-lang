const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { spawnSync } = require("node:child_process");

function main() {
  const baseline = JSON.parse(readFileSync(resolve("benchmarks", "app-baseline.json"), "utf8"));
  const run = spawnSync(process.execPath, [resolve("benchmarks", "run-app-level-bench.cjs")], {
    encoding: "utf8",
  });
  if (run.status !== 0) {
    process.stderr.write(run.stderr || run.stdout || "bench:apps failed\n");
    process.exit(run.status || 1);
  }

  const payload = parseJson(run.stdout);
  const failures = [];

  for (const app of payload.apps || []) {
    const rule = baseline.apps[app.app];
    if (!rule) {
      continue;
    }
    if (app.buildMs > rule.maxBuildMs) {
      failures.push(`${app.app}: buildMs ${app.buildMs} > ${rule.maxBuildMs}`);
    }
    if (app.runtime.rendersPerSecond < rule.minRendersPerSecond) {
      failures.push(
        `${app.app}: rendersPerSecond ${app.runtime.rendersPerSecond} < ${rule.minRendersPerSecond}`,
      );
    }
    if (app.files.totalKb > rule.maxTotalKb) {
      failures.push(`${app.app}: totalKb ${app.files.totalKb} > ${rule.maxTotalKb}`);
    }
    if (app.routes < rule.minRoutes) {
      failures.push(`${app.app}: routes ${app.routes} < ${rule.minRoutes}`);
    }
  }

  if (payload.summary.avgBuildMs > baseline.summary.maxAvgBuildMs) {
    failures.push(
      `summary: avgBuildMs ${payload.summary.avgBuildMs} > ${baseline.summary.maxAvgBuildMs}`,
    );
  }
  if (payload.summary.avgRendersPerSecond < baseline.summary.minAvgRendersPerSecond) {
    failures.push(
      `summary: avgRendersPerSecond ${payload.summary.avgRendersPerSecond} < ${baseline.summary.minAvgRendersPerSecond}`,
    );
  }

  const result = {
    benchmark: "app-regression-gate",
    pass: failures.length === 0,
    failures,
    measured: payload.summary,
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
