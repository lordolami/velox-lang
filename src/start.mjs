import { existsSync } from "node:fs";
import { runServer } from "./server-runtime.mjs";

export async function runStart() {
  if (!existsSync("dist/fastscript-manifest.json")) {
    throw new Error("Missing production build. Run: fastscript build");
  }
  const port = Number(process.env.PORT || 4173);
  await runServer({ mode: process.env.NODE_ENV || "production", watchMode: false, buildOnStart: false, port });
}
