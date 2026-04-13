import { existsSync } from "node:fs";
import { resolve } from "node:path";

export async function runCheck() {
  const indexExists = existsSync(resolve("app/pages/index.fs")) || existsSync(resolve("app/pages/index.js"));
  const layoutExists = existsSync(resolve("app/pages/_layout.fs")) || existsSync(resolve("app/pages/_layout.js"));

  const required = [
    resolve("app"),
    resolve("app/pages"),
  ];

  const missing = required.filter((path) => !existsSync(path));
  if (!indexExists) missing.push("app/pages/index.fs (or index.js)");
  if (!layoutExists) missing.push("app/pages/_layout.fs (or _layout.js)");

  if (missing.length > 0) {
    throw new Error(`Missing required FastScript files:\n${missing.join("\n")}`);
  }

  console.log("check passed: FastScript app structure is valid");
}
