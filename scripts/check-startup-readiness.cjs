#!/usr/bin/env node
const { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { join, resolve } = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = resolve(__dirname, "..");
const reportsDir = join(repoRoot, "spec", "reports");
mkdirSync(reportsDir, { recursive: true });

const nodeBin = process.execPath;
const npmExecPath = process.env.npm_execpath;
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

const commandChecks = [
  ["run", "build"],
  ["test"],
  ["run", "bench:ai"],
  ["run", "lsp:gate"],
  ["run", "bench:fast:gate"],
  ["run", "bench:apps:gate"],
  ["run", "check:deterministic"],
  ["run", "verify:quickstart"],
  ["run", "check:velox-web"],
];

const fileChecks = [
  "spec/MASTER_SPEC.md",
  "spec/framework-v1.md",
  "spec/docs-index.json",
  "spec/quickstart.md",
  "spec/interop.md",
  "spec/launch-checklist.md",
  "spec/AI_BOOTSTRAP_A_TO_Z.md",
  "spec/AY_COMPLETION_STATUS.md",
  "spec/startup/README.md",
  "spec/startup/ai-build-contract.md",
  "spec/startup/env-and-secrets.md",
  "spec/startup/hosting-and-cloud.md",
  "spec/startup/monitoring-and-rollback.md",
  "spec/startup/security-baseline.md",
  "spec/startup/qa-matrix.md",
  "spec/startup/external-beta.md",
  "spec/startup/feedback-loop.md",
  "spec/startup/velox-web-runbook.md",
  "apps/velox-web/velox.config.json",
  "apps/velox-web/pages/index.vx",
  "apps/velox-web/pages/docs/index.vx",
  "apps/velox-web/pages/benchmarks.vx",
  ".env.example",
];

function runCommand(command, args) {
  const startedAt = Date.now();
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
  const elapsedMs = Date.now() - startedAt;
  return {
    command: [command, ...args].join(" "),
    ok: result.status === 0,
    status: result.status,
    elapsedMs,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function runNpm(args) {
  if (npmExecPath) {
    return runCommand(nodeBin, [npmExecPath, ...args]);
  }
  const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";
  return runCommand(npmBin, args);
}

function runCloudDeploySmoke() {
  const smokeRoot = join(repoRoot, ".velox", "startup-smoke");
  rmSync(smokeRoot, { recursive: true, force: true });

  const buildArgs = ["dist/cli.js", "build", "examples/pages", "-o", ".velox/startup-smoke/build"];
  const deployTargets = ["local", "vercel", "netlify", "cloudflare-pages"];
  const checks = [];

  const buildStep = runCommand(nodeBin, buildArgs);
  checks.push({ name: "build-examples-pages", ...buildStep });
  if (!buildStep.ok) {
    return checks;
  }

  for (const target of deployTargets) {
    const deployStep = runCommand(nodeBin, [
      "dist/cli.js",
      "deploy",
      "examples/pages",
      "--target",
      target,
      "--name",
      `ay-${target}`,
      "--build-out",
      ".velox/startup-smoke/build",
      "--deploy-out",
      `.velox/startup-smoke/deploy/${target}`,
    ]);
    checks.push({ name: `deploy-${target}`, ...deployStep });
  }

  return checks;
}

const commandResults = commandChecks.map((args) => runNpm(args));
const cloudResults = runCloudDeploySmoke();
const fileResults = fileChecks.map((path) => ({
  path,
  ok: existsSync(join(repoRoot, path)),
}));

let docsIndexParsed = null;
try {
  docsIndexParsed = JSON.parse(readFileSync(join(repoRoot, "spec", "docs-index.json"), "utf8"));
} catch {
  docsIndexParsed = null;
}

const docsIndexCheck = {
  ok: Boolean(
    docsIndexParsed &&
      Array.isArray(docsIndexParsed.documents) &&
      docsIndexParsed.documents.some((doc) => doc.path === "spec/AY_COMPLETION_STATUS.md") &&
      docsIndexParsed.documents.some((doc) => doc.path === "spec/startup/README.md") &&
      docsIndexParsed.documents.some((doc) => doc.path === "spec/startup/velox-web-runbook.md"),
  ),
};

const pass =
  commandResults.every((r) => r.ok) &&
  cloudResults.every((r) => r.ok) &&
  fileResults.every((r) => r.ok) &&
  docsIndexCheck.ok;

const report = {
  check: "startup-a-y-readiness",
  pass,
  generatedAt: new Date().toISOString(),
  commandResults,
  cloudResults,
  fileResults,
  docsIndexCheck,
};

const reportPath = join(reportsDir, `startup-readiness-${timestamp}.json`);
writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");
console.log(JSON.stringify({ ...report, reportPath }, null, 2));

if (!pass) {
  process.exitCode = 1;
}
