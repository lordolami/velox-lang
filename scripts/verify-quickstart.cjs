const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const { performance } = require("node:perf_hooks");
const http = require("node:http");

async function main() {
  const root = mkdtempSync(join(tmpdir(), "velox-quickstart-"));
  const appDir = join(root, "my-app");
  const devPort = 43110;
  const previewPort = 43111;
  const distCli = resolve("dist", "cli.js");
  const result = {
    benchmark: "quickstart-flow",
    pass: false,
    elapsedMs: 0,
    steps: [],
    thresholds: {
      maxMinutes: 5,
      maxMinutesHard: 15,
    },
    paths: {
      appDir,
    },
  };

  const start = performance.now();
  try {
    runStep(result, "init", [process.execPath, [distCli, "init", appDir, "--template", "pages"]]);
    const dev = spawn(process.execPath, [distCli, "dev", appDir, "--port", String(devPort)], {
      cwd: resolve("."),
      stdio: ["ignore", "pipe", "pipe"],
    });
    await waitForHttp(`http://127.0.0.1:${devPort}/`, 15000);
    dev.kill("SIGTERM");
    result.steps.push({ name: "dev", ok: true });

    runStep(result, "build", [process.execPath, [distCli, "build", appDir, "-o", join(appDir, "dist")]]);

    const preview = spawn(process.execPath, [distCli, "preview", join(appDir, "dist"), "--port", String(previewPort)], {
      cwd: resolve("."),
      stdio: ["ignore", "pipe", "pipe"],
    });
    await waitForHttp(`http://127.0.0.1:${previewPort}/`, 15000);
    preview.kill("SIGTERM");
    result.steps.push({ name: "preview", ok: true });

    runStep(result, "deploy", [process.execPath, [distCli, "deploy", appDir, "--target", "local", "--name", "quickstart"]]);

    result.elapsedMs = round(performance.now() - start);
    result.elapsedMinutes = round(result.elapsedMs / 60000);
    result.pass = result.elapsedMinutes <= result.thresholds.maxMinutesHard;
  } catch (error) {
    result.elapsedMs = round(performance.now() - start);
    result.elapsedMinutes = round(result.elapsedMs / 60000);
    result.error = String(error && error.message ? error.message : error);
    result.pass = false;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }

  console.log(JSON.stringify(result, null, 2));
  if (!result.pass) {
    process.exit(1);
  }
}

function runStep(result, name, tuple) {
  const [cmd, args] = tuple;
  const started = performance.now();
  const run = spawnSync(cmd, args, {
    cwd: resolve("."),
    encoding: "utf8",
  });
  const elapsedMs = round(performance.now() - started);
  const step = {
    name,
    ok: run.status === 0,
    elapsedMs,
  };
  if (run.status !== 0) {
    step.stdout = run.stdout || "";
    step.stderr = run.stderr || "";
    result.steps.push(step);
    throw new Error(`Quickstart step "${name}" failed.`);
  }
  result.steps.push(step);
}

function waitForHttp(url, timeoutMs) {
  const start = Date.now();
  return new Promise((resolvePromise, reject) => {
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 500) {
          resolvePromise();
          return;
        }
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timed out waiting for HTTP readiness: ${url}`));
          return;
        }
        setTimeout(tick, 200);
      });
      req.on("error", () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timed out waiting for HTTP readiness: ${url}`));
          return;
        }
        setTimeout(tick, 200);
      });
    };
    tick();
  });
}

function round(value) {
  return Number(value.toFixed(3));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
