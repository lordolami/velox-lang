const { readdirSync } = require("node:fs");
const { join, resolve } = require("node:path");
const { spawnSync } = require("node:child_process");

function main() {
  const validDir = resolve("ai-suite", "valid");
  const invalidDir = resolve("ai-suite", "invalid");

  const valid = runCases(validDir, true);
  const invalid = runCases(invalidDir, false);

  const total = valid.total + invalid.total;
  const passed = valid.passed + invalid.passed;
  const overallRate = total === 0 ? 0 : passed / total;

  console.log(
    JSON.stringify(
      {
        benchmark: "ai-reliability",
        runtime: process.version,
        totals: {
          total,
          passed,
          overallPassRate: round(overallRate * 100),
        },
        validSuite: {
          total: valid.total,
          passed: valid.passed,
          compilePassRate: round((valid.total === 0 ? 0 : valid.passed / valid.total) * 100),
          failures: valid.failures,
        },
        invalidSuite: {
          total: invalid.total,
          passed: invalid.passed,
          rejectionRate: round((invalid.total === 0 ? 0 : invalid.passed / invalid.total) * 100),
          failures: invalid.failures,
        },
      },
      null,
      2,
    ),
  );

  if (passed !== total) {
    process.exitCode = 1;
  }
}

function runCases(dir, expectSuccess) {
  const files = readdirSync(dir).filter((name) => name.endsWith(".vx")).sort();
  let passed = 0;
  const failures = [];

  for (const file of files) {
    const target = join(dir, file);
    const result = spawnSync(process.execPath, [resolve("dist", "cli.js"), "check", target], {
      cwd: resolve("."),
      encoding: "utf8",
    });
    const success = result.status === 0;
    const ok = expectSuccess ? success : !success;
    if (ok) {
      passed += 1;
      continue;
    }
    failures.push({
      file,
      expected: expectSuccess ? "compile-pass" : "compile-fail",
      actual: success ? "compile-pass" : "compile-fail",
      stderr: (result.stderr || "").trim(),
      stdout: (result.stdout || "").trim(),
    });
  }

  return { total: files.length, passed, failures };
}

function round(value) {
  return Number(value.toFixed(2));
}

main();
