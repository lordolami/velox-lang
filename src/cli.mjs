#!/usr/bin/env node
import { createApp } from "./create.mjs";
import { runDev } from "./dev.mjs";
import { runBuild } from "./build.mjs";
import { runCheck } from "./check.mjs";
import { runMigrate } from "./migrate.mjs";
import { runBench } from "./bench.mjs";
import { runExport } from "./export.mjs";
import { runCompat } from "./compat.mjs";
import { runValidate } from "./validate.mjs";
import { runDbMigrate, runDbSeed } from "./db-cli.mjs";
import { runStart } from "./start.mjs";
import { runDeploy } from "./deploy.mjs";
import { runWorkerCommand } from "./worker.mjs";

const [, , command, ...args] = process.argv;

async function main() {
  switch (command) {
    case "create":
      await createApp(args[0] ?? "app");
      break;
    case "dev":
      await runDev();
      break;
    case "start":
      await runStart();
      break;
    case "build":
      await runBuild();
      break;
    case "check":
      await runCheck();
      break;
    case "migrate":
      await runMigrate(args[0] ?? "app/pages");
      break;
    case "bench":
      await runBench();
      break;
    case "export":
      await runExport(args);
      break;
    case "compat":
      await runCompat();
      break;
    case "validate":
      await runValidate();
      break;
    case "db:migrate":
      await runDbMigrate();
      break;
    case "db:seed":
      await runDbSeed();
      break;
    case "deploy":
      await runDeploy(args);
      break;
    case "worker":
      await runWorkerCommand();
      break;
    default:
      console.log("FastScript CLI");
      console.log("Commands: create, dev, start, build, check, migrate, bench, export, compat, validate, db:migrate, db:seed, deploy, worker");
  }
}

main().catch((error) => {
  console.error("fastscript error:", error.message);
  process.exit(1);
});
