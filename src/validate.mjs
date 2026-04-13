import { runCheck } from "./check.mjs";
import { runBuild } from "./build.mjs";
import { runBench } from "./bench.mjs";
import { runCompat } from "./compat.mjs";
import { runExport } from "./export.mjs";
import { runDbMigrate, runDbSeed } from "./db-cli.mjs";

export async function runValidate() {
  await runCheck();
  await runBuild();
  await runBench();
  await runCompat();
  await runDbMigrate();
  await runDbSeed();
  await runExport(["--to", "js", "--out", "exported-js-app"]);
  await runExport(["--to", "ts", "--out", "exported-ts-app"]);
  console.log("validate complete: check/build/bench/compat/db/export all passed");
}
