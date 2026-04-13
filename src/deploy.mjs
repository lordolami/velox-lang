import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";

export async function runDeploy(args = []) {
  let target = "node";
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--target") target = (args[i + 1] || "node").toLowerCase();
  }

  const root = resolve(process.cwd());

  if (target === "node" || target === "pm2") {
    const file = join(root, "ecosystem.config.cjs");
    writeFileSync(
      file,
      `module.exports = { apps: [{ name: "fastscript-app", script: "node", args: "./src/cli.mjs start", env: { NODE_ENV: "production", PORT: 4173 } }] };\n`,
      "utf8",
    );
    writeFileSync(
      join(root, "Dockerfile"),
      `FROM node:20-alpine\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci --omit=dev\nCOPY . .\nRUN npm run build\nENV NODE_ENV=production\nEXPOSE 4173\nCMD [\"node\",\"./src/cli.mjs\",\"start\"]\n`,
      "utf8",
    );
    console.log("deploy adapter ready: ecosystem.config.cjs (PM2/Node)");
    return;
  }

  if (target === "vercel") {
    const file = join(root, "vercel.json");
    writeFileSync(
      file,
      JSON.stringify(
        {
          version: 2,
          builds: [{ src: "package.json", use: "@vercel/node" }],
          routes: [{ src: "/(.*)", dest: "/src/cli.mjs" }],
        },
        null,
        2,
      ),
      "utf8",
    );
    console.log("deploy adapter ready: vercel.json");
    return;
  }

  if (target === "cloudflare") {
    const wrangler = join(root, "wrangler.toml");
    writeFileSync(
      wrangler,
      `name = "fastscript-app"\nmain = "dist/worker.js"\ncompatibility_date = "2026-01-01"\n[assets]\ndirectory = "dist"\n`,
      "utf8",
    );
    mkdirSync(join(root, "dist"), { recursive: true });
    writeFileSync(
      join(root, "dist", "worker.js"),
      `export default { async fetch(req, env) { return env.ASSETS.fetch(req); } };\n`,
      "utf8",
    );
    console.log("deploy adapter ready: wrangler.toml + dist/worker.js");
    return;
  }

  throw new Error(`Unknown deploy target: ${target}. Use node|pm2|vercel|cloudflare`);
}
