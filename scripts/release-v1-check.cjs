const { writeFileSync, mkdirSync } = require("node:fs");
const { resolve, join } = require("node:path");
const { spawnSync } = require("node:child_process");

const CHECKS = [
  { name: "build", npmArgs: ["run", "build"] },
  { name: "test", npmArgs: ["test"] },
  { name: "ai", npmArgs: ["run", "bench:ai"] },
  { name: "lsp", npmArgs: ["run", "lsp:gate"] },
  { name: "fast", npmArgs: ["run", "bench:fast:gate"] },
  { name: "apps", npmArgs: ["run", "bench:apps:gate"] },
  { name: "deterministic", command: process.execPath, args: [resolve("scripts", "check-deterministic-output.cjs")] },
  { name: "quickstart", command: process.execPath, args: [resolve("scripts", "verify-quickstart.cjs")] },
  { name: "velox-web", command: process.execPath, args: [resolve("scripts", "check-velox-web.cjs")] },
];

function main() {
  const startedAt = new Date().toISOString();
  const results = [];

  for (const check of CHECKS) {
    const start = Date.now();
    const { command, args } = resolveCommand(check);
    const run = spawnSync(command, args, {
      cwd: resolve("."),
      encoding: "utf8",
    });
    const elapsedMs = Date.now() - start;
    results.push({
      name: check.name,
      ok: run.status === 0,
      elapsedMs,
      stdout: truncate(run.stdout || ""),
      stderr: truncate(run.stderr || ""),
    });
    if (run.status !== 0) {
      break;
    }
  }

  const pass = results.every((entry) => entry.ok);
  const payload = {
    check: "release-v1",
    pass,
    startedAt,
    finishedAt: new Date().toISOString(),
    results,
  };

  mkdirSync(resolve("spec", "reports"), { recursive: true });
  const safeStamp = payload.finishedAt.replaceAll(":", "-").replace(".", "-");
  const reportPath = join(resolve("spec", "reports"), `v1-release-readiness-${safeStamp}.json`);
  writeFileSync(reportPath, JSON.stringify(payload, null, 2) + "\n", "utf8");

  console.log(JSON.stringify({ ...payload, reportPath }, null, 2));
  if (!pass) {
    process.exit(1);
  }
}

function truncate(value) {
  const max = 4000;
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max)}\n...[truncated ${value.length - max} chars]`;
}

function resolveCommand(check) {
  if (check.npmArgs) {
    if (process.env.npm_execpath) {
      return {
        command: process.execPath,
        args: [process.env.npm_execpath, ...check.npmArgs],
      };
    }
    const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
    return {
      command: npmCmd,
      args: check.npmArgs,
    };
  }
  return { command: check.command, args: check.args };
}

main();
