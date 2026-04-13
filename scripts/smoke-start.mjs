import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

async function waitFor(url, ms = 20000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const r = await fetch(url);
      if (r.status >= 200) return;
    } catch {}
    await sleep(300);
  }
  throw new Error(`Timeout waiting for ${url}`);
}

const build = spawn(process.execPath, ["./src/cli.mjs", "build"], { cwd: process.cwd(), stdio: "inherit" });
await new Promise((resolve, reject) => {
  build.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`build failed: ${code}`))));
});

const proc = spawn(process.execPath, ["./src/cli.mjs", "start"], {
  cwd: process.cwd(),
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, PORT: "4173", NODE_ENV: "production" },
});

try {
  await waitFor("http://localhost:4173/");
  const home = await fetch("http://localhost:4173/");
  if (home.status !== 200) throw new Error(`start home status ${home.status}`);
  const reqId = home.headers.get("x-request-id");
  if (!reqId) throw new Error("missing x-request-id header");

  const api = await fetch("http://localhost:4173/api/hello", { headers: { accept: "application/json" } });
  if (api.status !== 200) throw new Error(`start api status ${api.status}`);

  console.log("smoke-start pass: production adapter serving SSR/API with request IDs");
} finally {
  proc.kill("SIGTERM");
  await sleep(300);
}
