const { mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const { join, resolve } = require("node:path");
const { spawnSync } = require("node:child_process");

function main() {
  const benchResult = runBench();
  const baseline = readJson(resolve("benchmarks", "app-baseline.json"));
  const report = buildReport(benchResult, baseline);

  const reportsDir = resolve("spec", "reports");
  mkdirSync(reportsDir, { recursive: true });

  const jsonPath = join(reportsDir, "app-benchmark-latest.json");
  const mdPath = join(reportsDir, "app-benchmark-latest.md");
  writeFileSync(jsonPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  writeFileSync(mdPath, renderMarkdown(report), "utf8");

  console.log(
    JSON.stringify(
      {
        benchmark: "app-report",
        pass: report.pass,
        summary: report.summary,
        reportPaths: { json: jsonPath, markdown: mdPath },
      },
      null,
      2,
    ),
  );
}

function runBench() {
  const script = resolve("benchmarks", "run-app-level-bench.cjs");
  const run = spawnSync(process.execPath, [script], { encoding: "utf8" });
  if (run.status !== 0) {
    throw new Error(
      `Failed to run app benchmark.\nstdout:\n${run.stdout || ""}\nstderr:\n${run.stderr || ""}`,
    );
  }
  const payload = extractJson(run.stdout);
  if (!payload || !Array.isArray(payload.apps) || !payload.summary) {
    throw new Error("Invalid app benchmark payload.");
  }
  return payload;
}

function buildReport(bench, baseline) {
  const appRows = [];
  const failures = [];
  for (const app of bench.apps) {
    const limits = baseline.apps && baseline.apps[app.app] ? baseline.apps[app.app] : null;
    const checks = {
      buildMs: limits ? app.buildMs <= limits.maxBuildMs : true,
      rendersPerSecond: limits ? app.runtime.rendersPerSecond >= limits.minRendersPerSecond : true,
      totalKb: limits ? app.files.totalKb <= limits.maxTotalKb : true,
      routes: limits ? app.routes >= limits.minRoutes : true,
    };
    if (limits) {
      if (!checks.buildMs) {
        failures.push(`${app.app}: buildMs ${app.buildMs} > max ${limits.maxBuildMs}`);
      }
      if (!checks.rendersPerSecond) {
        failures.push(
          `${app.app}: rendersPerSecond ${app.runtime.rendersPerSecond} < min ${limits.minRendersPerSecond}`,
        );
      }
      if (!checks.totalKb) {
        failures.push(`${app.app}: totalKb ${app.files.totalKb} > max ${limits.maxTotalKb}`);
      }
      if (!checks.routes) {
        failures.push(`${app.app}: routes ${app.routes} < min ${limits.minRoutes}`);
      }
    }
    appRows.push({
      app: app.app,
      buildMs: app.buildMs,
      rendersPerSecond: app.runtime.rendersPerSecond,
      totalKb: app.files.totalKb,
      routes: app.routes,
      limits,
      checks,
    });
  }

  const summaryChecks = {
    avgBuildMs:
      baseline.summary && typeof baseline.summary.maxAvgBuildMs === "number"
        ? bench.summary.avgBuildMs <= baseline.summary.maxAvgBuildMs
        : true,
    avgRendersPerSecond:
      baseline.summary && typeof baseline.summary.minAvgRendersPerSecond === "number"
        ? bench.summary.avgRendersPerSecond >= baseline.summary.minAvgRendersPerSecond
        : true,
  };
  if (!summaryChecks.avgBuildMs && baseline.summary) {
    failures.push(
      `summary: avgBuildMs ${bench.summary.avgBuildMs} > max ${baseline.summary.maxAvgBuildMs}`,
    );
  }
  if (!summaryChecks.avgRendersPerSecond && baseline.summary) {
    failures.push(
      `summary: avgRendersPerSecond ${bench.summary.avgRendersPerSecond} < min ${baseline.summary.minAvgRendersPerSecond}`,
    );
  }

  return {
    benchmark: "app-level-report",
    generatedAt: new Date().toISOString(),
    runtime: bench.runtime,
    pass: failures.length === 0,
    failures,
    summary: {
      ...bench.summary,
      checks: summaryChecks,
    },
    apps: appRows,
    baselineVersion: baseline.version ?? 1,
    baselineUpdatedAt: baseline.updatedAt ?? null,
  };
}

function renderMarkdown(report) {
  const status = report.pass ? "PASS" : "FAIL";
  const baseline = readJson(resolve("benchmarks", "app-baseline.json"));
  const maxAvgBuild = baseline.summary && typeof baseline.summary.maxAvgBuildMs === "number"
    ? baseline.summary.maxAvgBuildMs
    : null;
  const minAvgRps = baseline.summary && typeof baseline.summary.minAvgRendersPerSecond === "number"
    ? baseline.summary.minAvgRendersPerSecond
    : null;
  const lines = [
    "# Velox App Benchmark Report",
    "",
    `Generated: ${report.generatedAt}`,
    `Runtime: ${report.runtime}`,
    `Status: **${status}**`,
    "",
    "## Summary",
    "",
    "| Metric | Value | Threshold | Check |",
    "| --- | ---: | ---: | :---: |",
    `| Avg Build (ms) | ${fmt(report.summary.avgBuildMs)} | ${maxAvgBuild === null ? "n/a" : `<= ${fmt(maxAvgBuild)}`} | ${mark(report.summary.checks.avgBuildMs)} |`,
    `| Avg Renders/sec | ${fmt(report.summary.avgRendersPerSecond)} | ${minAvgRps === null ? "n/a" : `>= ${fmt(minAvgRps)}`} | ${mark(report.summary.checks.avgRendersPerSecond)} |`,
    `| Total Bundle (KB) | ${fmt(report.summary.totalBundleKb)} | n/a | n/a |`,
    "",
    "## App Breakdown",
    "",
    "| App | Build ms | Renders/sec | Bundle KB | Routes | Checks |",
    "| --- | ---: | ---: | ---: | ---: | :---: |",
  ];

  for (const app of report.apps) {
    const ok = app.checks.buildMs && app.checks.rendersPerSecond && app.checks.totalKb && app.checks.routes;
    lines.push(
      `| ${app.app} | ${fmt(app.buildMs)} | ${fmt(app.rendersPerSecond)} | ${fmt(app.totalKb)} | ${app.routes} | ${mark(ok)} |`,
    );
  }

  if (report.failures.length > 0) {
    lines.push("", "## Failures", "");
    for (const failure of report.failures) {
      lines.push(`- ${failure}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

function fmt(value) {
  return Number(value).toFixed(3);
}

function mark(ok) {
  return ok ? "PASS" : "FAIL";
}

function extractJson(text) {
  const raw = String(text || "").trim();
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    return null;
  }
  return JSON.parse(raw.slice(first, last + 1));
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

main();
