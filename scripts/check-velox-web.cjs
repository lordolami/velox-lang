#!/usr/bin/env node
const { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { join, resolve } = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = resolve(__dirname, "..");
const reportsDir = join(repoRoot, "spec", "reports");
mkdirSync(reportsDir, { recursive: true });

const nodeBin = process.execPath;
const smokeRoot = join(repoRoot, ".velox", "velox-web-smoke");
const appDir = resolve(repoRoot, "apps", "velox-web");
const buildOut = join(smokeRoot, "dist");
const deployOut = join(smokeRoot, "deploy");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

function run(command, args) {
  const started = Date.now();
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
  return {
    command: [command, ...args].join(" "),
    ok: result.status === 0,
    status: result.status,
    elapsedMs: Date.now() - started,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

function main() {
  rmSync(smokeRoot, { recursive: true, force: true });

  const checks = [];
  checks.push(run(nodeBin, [join(repoRoot, "dist", "cli.js"), "check", appDir]));
  checks.push(run(nodeBin, [join(repoRoot, "dist", "cli.js"), "build", appDir, "-o", buildOut]));

  const targetChecks = [];
  for (const target of ["local", "vercel", "netlify", "cloudflare-pages"]) {
    targetChecks.push(
      run(nodeBin, [
        join(repoRoot, "dist", "cli.js"),
        "deploy",
        appDir,
        "--target",
        target,
        "--name",
        `velox-web-${target}`,
        "--build-out",
        buildOut,
        "--deploy-out",
        join(deployOut, target),
      ]),
    );
  }

  const outputChecks = [
    { path: join(buildOut, "index.html"), ok: existsSync(join(buildOut, "index.html")) },
    { path: join(buildOut, "__velox_router.js"), ok: existsSync(join(buildOut, "__velox_router.js")) },
    { path: join(buildOut, "pages", "index.js"), ok: existsSync(join(buildOut, "pages", "index.js")) },
    { path: join(buildOut, "pages", "docs", "index.js"), ok: existsSync(join(buildOut, "pages", "docs", "index.js")) },
    { path: join(buildOut, "pages", "blog", "[slug].js"), ok: existsSync(join(buildOut, "pages", "blog", "[slug].js")) },
    { path: join(buildOut, "styles", "global.css"), ok: existsSync(join(buildOut, "styles", "global.css")) },
    { path: join(buildOut, "velox-manifest.json"), ok: existsSync(join(buildOut, "velox-manifest.json")) },
  ];

  let manifestChecks = { ok: false, routeCount: 0, fileCount: 0 };
  const manifestPath = join(buildOut, "velox-manifest.json");
  if (existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      manifestChecks = {
        ok:
          manifest &&
          manifest.router &&
          typeof manifest.router.routeCount === "number" &&
          manifest.router.routeCount >= 8 &&
          manifest.files &&
          Array.isArray(manifest.files.modules),
        routeCount: manifest?.router?.routeCount || 0,
        fileCount: Array.isArray(manifest?.files?.modules) ? manifest.files.modules.length : 0,
      };
    } catch {
      manifestChecks = { ok: false, routeCount: 0, fileCount: 0 };
    }
  }

  const pass =
    checks.every((entry) => entry.ok) &&
    targetChecks.every((entry) => entry.ok) &&
    outputChecks.every((entry) => entry.ok) &&
    manifestChecks.ok;

  const report = {
    check: "velox-web-hardening",
    pass,
    appDir,
    checks,
    targetChecks,
    outputChecks,
    manifestChecks,
  };

  const reportPath = join(reportsDir, `velox-web-hardening-${timestamp}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(JSON.stringify({ ...report, reportPath }, null, 2));

  if (!pass) {
    process.exit(1);
  }
}

main();

