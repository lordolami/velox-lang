import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

async function waitFor(url, ms = 20000) {
  const start = Date.now();
  let lastErr = null;
  while (Date.now() - start < ms) {
    try {
      const r = await fetch(url);
      if (r.status >= 200 && r.status < 600) return r;
    } catch (e) {
      lastErr = e;
    }
    await sleep(300);
  }
  throw new Error(`Timeout waiting for ${url}${lastErr ? `: ${lastErr.message}` : ""}`);
}

const proc = spawn(process.execPath, ["./src/cli.mjs", "dev"], {
  cwd: process.cwd(),
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env },
});

let output = "";
proc.stdout.on("data", (d) => (output += d.toString()));
proc.stderr.on("data", (d) => (output += d.toString()));

try {
  await waitFor("http://localhost:4173/");

  const home = await fetch("http://localhost:4173/");
  if (home.status !== 200) throw new Error(`Home status ${home.status}`);
  const html = await home.text();
  if (!html.includes("FastScript")) throw new Error("Home SSR did not include FastScript text");

  const api = await fetch("http://localhost:4173/api/hello");
  if (api.status !== 200) throw new Error(`API status ${api.status}`);
  const apiJson = await api.json();
  if (!apiJson.ok) throw new Error("API JSON did not return ok=true");

  const privateRes = await fetch("http://localhost:4173/private", { redirect: "manual" });
  if (!(privateRes.status === 302 || privateRes.status === 307)) {
    throw new Error(`Expected redirect on /private, got ${privateRes.status}`);
  }

  const login = await fetch("http://localhost:4173/api/auth", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
    redirect: "manual",
  });
  if (login.status !== 200) throw new Error(`Auth login failed: ${login.status}`);
  const setCookie = login.headers.get("set-cookie");
  if (!setCookie || !setCookie.includes("fs_session=")) throw new Error("Missing fs_session cookie on login");

  const bad = await fetch("http://localhost:4173/api/auth", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: "{bad",
  });
  if (bad.status !== 400) throw new Error(`Expected 400 on invalid JSON, got ${bad.status}`);

  const upload = await fetch("http://localhost:4173/api/upload", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ key: "smoke/one.txt", content: "hello" }),
  });
  if (upload.status !== 200) throw new Error(`Upload failed: ${upload.status}`);
  const up = await upload.json();
  const blob = await fetch(`http://localhost:4173${up.url}`);
  if (blob.status !== 200) throw new Error(`Uploaded blob fetch failed: ${blob.status}`);

  console.log("smoke-dev pass: SSR, API, middleware redirect, auth cookie, validation, upload");
} finally {
  proc.kill("SIGTERM");
  await sleep(400);
}
