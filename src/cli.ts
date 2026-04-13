#!/usr/bin/env node
import { statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { checkProject, compileProject } from "./compiler";
import { loadVeloxConfig, resolveConfigPathValue } from "./config";
import { startDevServer } from "./dev-server";
import { deployCloudBuild, deployLocalBuild, listLocalDeployments } from "./deploy";
import { startPreviewServer } from "./preview-server";
import { initProject, type VeloxTemplate } from "./scaffold";

function main(): void {
  const [, , command, ...rest] = process.argv;

  if (!command || command === "help" || command === "--help") {
    printHelp();
    return;
  }

  if (command === "build") {
    runBuildCommand(rest);
    return;
  }

  if (command === "dev") {
    runDevCommand(rest);
    return;
  }
  if (command === "check") {
    runCheckCommand(rest);
    return;
  }
  if (command === "init") {
    runInitCommand(rest);
    return;
  }
  if (command === "deploy") {
    runDeployCommand(rest);
    return;
  }
  if (command === "preview") {
    runPreviewCommand(rest);
    return;
  }
  if (command === "deployments") {
    runDeploymentsCommand(rest);
    return;
  }

  console.error(`Unknown command: ${command}`);
  printHelp();
  process.exitCode = 1;
}

function runBuildCommand(args: string[]): void {
  const input = args[0];
  if (!input) {
    console.error("Missing input .vx file or directory.");
    printHelp();
    process.exitCode = 1;
    return;
  }

  let outputPathOrDir: string | undefined;
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-o" || arg === "--out") {
      const value = args[i + 1];
      if (!value) {
        console.error("Missing output path after -o/--out");
        process.exitCode = 1;
        return;
      }
      outputPathOrDir = resolve(value);
      i++;
      continue;
    }
    console.error(`Unknown option: ${arg}`);
    process.exitCode = 1;
    return;
  }

  try {
    const inputPath = resolve(input);
    const isDirectory = statSync(inputPath).isDirectory();
    const projectRoot = isDirectory ? inputPath : dirname(inputPath);
    const { config } = loadVeloxConfig(projectRoot);
    const configOutDir = resolveConfigPathValue(projectRoot, config.build?.outDir);
    const finalOutputPathOrDir = outputPathOrDir ?? (isDirectory ? configOutDir : undefined);
    const result = compileProject({
      inputPath,
      outputPath: isDirectory ? undefined : finalOutputPathOrDir,
      outputDir: isDirectory ? finalOutputPathOrDir : undefined,
      routerEnabled: config.build?.router?.enabled,
      routerTitle: config.build?.router?.title,
      copyPublic: config.build?.copyPublic,
    });
    if (isDirectory) {
      console.log(`Built ${result.outputPaths.length} file(s) from ${inputPath}`);
      if (result.outputPaths.length > 0) {
        console.log(`Output root: ${resolve(finalOutputPathOrDir ?? "dist")}`);
      }
      return;
    }
    console.log(`Built ${input} -> ${result.outputPaths[0]}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Build failed: ${message}`);
    process.exitCode = 1;
  }
}

function runDevCommand(args: string[]): void {
  const input = args[0];
  if (!input) {
    console.error("Missing input .vx file.");
    printHelp();
    process.exitCode = 1;
    return;
  }

  let outputDir: string | undefined;
  let port: number | undefined;
  let open: boolean | undefined;

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--dir") {
      const value = args[i + 1];
      if (!value) {
        console.error("Missing output directory after --dir");
        process.exitCode = 1;
        return;
      }
      outputDir = resolve(value);
      i++;
      continue;
    }
    if (arg === "--port") {
      const value = args[i + 1];
      if (!value || Number.isNaN(Number(value))) {
        console.error("Invalid port. Use --port <number>");
        process.exitCode = 1;
        return;
      }
      port = Number(value);
      i++;
      continue;
    }
    if (arg === "--open") {
      open = true;
      continue;
    }
    console.error(`Unknown option: ${arg}`);
    process.exitCode = 1;
    return;
  }

  try {
    const inputPath = resolve(input);
    const inputStats = statSync(inputPath);
    const projectRoot = inputStats.isDirectory() ? inputPath : dirname(inputPath);
    const { config } = loadVeloxConfig(projectRoot);
    const finalOutputDir = outputDir ?? resolveConfigPathValue(projectRoot, config.dev?.outDir);
    const finalPort = port ?? config.dev?.port ?? 3000;
    const finalOpen = open ?? config.dev?.open ?? false;
    const handle = startDevServer({
      inputPath,
      outputDir: finalOutputDir,
      port: finalPort,
      open: finalOpen,
      routerEnabled: config.dev?.router?.enabled,
      routerTitle: config.dev?.router?.title,
      copyPublic: config.dev?.copyPublic,
    });
    const shutdown = (): void => {
      handle.close();
      process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Dev server failed: ${message}`);
    process.exitCode = 1;
  }
}

function runCheckCommand(args: string[]): void {
  const input = args[0];
  if (!input) {
    console.error("Missing input .vx file or directory.");
    printHelp();
    process.exitCode = 1;
    return;
  }
  if (args.length > 1) {
    console.error(`Unknown option: ${args[1]}`);
    process.exitCode = 1;
    return;
  }

  try {
    const inputPath = resolve(input);
    const result = checkProject({ inputPath });
    console.log(`Checked ${result.fileCount} file(s) from ${inputPath}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Check failed: ${message}`);
    process.exitCode = 1;
  }
}

function runInitCommand(args: string[]): void {
  const targetArg = args[0] ?? ".";
  let template: VeloxTemplate = "pages";
  let force = false;

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--template") {
      const value = args[i + 1];
      if (!value || (value !== "pages" && value !== "single")) {
        console.error('Invalid template. Use --template "pages" or "single".');
        process.exitCode = 1;
        return;
      }
      template = value;
      i++;
      continue;
    }
    if (arg === "--force") {
      force = true;
      continue;
    }
    console.error(`Unknown option: ${arg}`);
    process.exitCode = 1;
    return;
  }

  try {
    const result = initProject({
      targetDir: resolve(targetArg),
      template,
      force,
    });
    console.log(`Initialized Velox project at ${result.targetDir}`);
    console.log(`Template: ${result.template}`);
    console.log(`Files created: ${result.files.length}`);
    console.log("Next: run `npm run dev` (or `velox dev .`)");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Init failed: ${message}`);
    process.exitCode = 1;
  }
}

function runDeployCommand(args: string[]): void {
  const input = args[0];
  if (!input) {
    console.error("Missing input directory to deploy.");
    printHelp();
    process.exitCode = 1;
    return;
  }

  let target: "local" | "vercel" | "netlify" | "cloudflare-pages" | undefined;
  let appName: string | undefined;
  let buildOut: string | undefined;
  let deployOut: string | undefined;

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--target") {
      const value = args[i + 1];
      if (
        !value ||
        (value !== "local" &&
          value !== "vercel" &&
          value !== "netlify" &&
          value !== "cloudflare-pages")
      ) {
        console.error('Invalid target. Use --target "local|vercel|netlify|cloudflare-pages".');
        process.exitCode = 1;
        return;
      }
      target = value as "local" | "vercel" | "netlify" | "cloudflare-pages";
      i++;
      continue;
    }
    if (arg === "--name") {
      const value = args[i + 1];
      if (!value) {
        console.error("Missing app name after --name");
        process.exitCode = 1;
        return;
      }
      appName = value;
      i++;
      continue;
    }
    if (arg === "--build-out") {
      const value = args[i + 1];
      if (!value) {
        console.error("Missing directory after --build-out");
        process.exitCode = 1;
        return;
      }
      buildOut = resolve(value);
      i++;
      continue;
    }
    if (arg === "--deploy-out") {
      const value = args[i + 1];
      if (!value) {
        console.error("Missing directory after --deploy-out");
        process.exitCode = 1;
        return;
      }
      deployOut = resolve(value);
      i++;
      continue;
    }
    console.error(`Unknown option: ${arg}`);
    process.exitCode = 1;
    return;
  }

  try {
    const inputPath = resolve(input);
    const inputStats = statSync(inputPath);
    if (!inputStats.isDirectory()) {
      throw new Error("Deploy input must be a project directory.");
    }
    const projectRoot = inputPath;
    const { config } = loadVeloxConfig(projectRoot);
    const configBuildOut = resolveConfigPathValue(projectRoot, config.deploy?.buildOutDir ?? config.build?.outDir);
    const finalBuildOut = buildOut ?? configBuildOut ?? resolve(join(projectRoot, "dist"));
    const finalTarget = target ?? config.deploy?.target ?? "local";

    const buildResult = compileProject({
      inputPath: inputPath,
      outputDir: finalBuildOut,
      routerEnabled: config.build?.router?.enabled,
      routerTitle: config.build?.router?.title,
      copyPublic: config.build?.copyPublic,
    });
    const finalAppName = appName ?? config.deploy?.appName ?? projectRoot.split(/[/\\]/).at(-1) ?? "velox-app";
    const configDeployOut = resolveConfigPathValue(projectRoot, config.deploy?.outputDir);
    const deployResult =
      finalTarget === "local"
        ? deployLocalBuild({
            sourceDir: finalBuildOut,
            appName: finalAppName,
            deployRoot: deployOut ?? configDeployOut,
          })
        : deployCloudBuild({
            sourceDir: finalBuildOut,
            appName: finalAppName,
            target: finalTarget,
            deployRoot: deployOut ?? configDeployOut,
          });
    console.log(`Built ${buildResult.outputPaths.length} file(s) for deployment`);
    console.log(`Deployment target: ${deployResult.target}`);
    console.log(`Deployment ID: ${deployResult.deploymentId}`);
    console.log(`Deployment output: ${deployResult.outputDir}`);
    console.log(`Deployment manifest: ${deployResult.manifestPath}`);
    if (deployResult.instructionsPath) {
      console.log(`Deployment instructions: ${deployResult.instructionsPath}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Deploy failed: ${message}`);
    process.exitCode = 1;
  }
}

function runPreviewCommand(args: string[]): void {
  const dirArg = args[0] ?? "dist";
  let port: number | undefined;
  let open = false;
  let spaFallback = true;

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--port") {
      const value = args[i + 1];
      if (!value || Number.isNaN(Number(value))) {
        console.error("Invalid port. Use --port <number>");
        process.exitCode = 1;
        return;
      }
      port = Number(value);
      i++;
      continue;
    }
    if (arg === "--open") {
      open = true;
      continue;
    }
    if (arg === "--no-spa") {
      spaFallback = false;
      continue;
    }
    console.error(`Unknown option: ${arg}`);
    process.exitCode = 1;
    return;
  }

  try {
    const handle = startPreviewServer({
      dir: resolve(dirArg),
      port,
      open,
      spaFallback,
    });
    const shutdown = (): void => {
      handle.close();
      process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Preview failed: ${message}`);
    process.exitCode = 1;
  }
}

function runDeploymentsCommand(args: string[]): void {
  let projectArg = ".";
  let asJson = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--json") {
      asJson = true;
      continue;
    }
    if (arg.startsWith("-")) {
      console.error(`Unknown option: ${arg}`);
      process.exitCode = 1;
      return;
    }
    if (projectArg !== ".") {
      console.error(`Unknown argument: ${arg}`);
      process.exitCode = 1;
      return;
    }
    projectArg = arg;
    continue;
  }
  try {
    const projectRoot = resolve(projectArg);
    const { config } = loadVeloxConfig(projectRoot);
    const deployRoot =
      resolveConfigPathValue(projectRoot, config.deploy?.outputDir) ??
      resolve(join(projectRoot, ".velox", "deployments"));
    const deployments = listLocalDeployments(deployRoot);
    if (asJson) {
      console.log(JSON.stringify(deployments, null, 2));
      return;
    }
    if (deployments.length === 0) {
      console.log(`No deployments found at ${deployRoot}`);
      return;
    }
    console.log(`Deployments (${deployments.length}) at ${deployRoot}:`);
    for (const item of deployments) {
      console.log(`- ${item.deploymentId} | ${item.appName} | ${item.deployedAt}`);
      console.log(`  output: ${item.outputDir}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Deployments failed: ${message}`);
    process.exitCode = 1;
  }
}

function printHelp(): void {
  console.log(`Velox CLI

Usage:
  velox init [dir] [--template pages|single] [--force]
  velox build <input.vx|dir> [-o output.js|out-dir]
  velox dev <input.vx|dir> [--dir dist-dev] [--port 3000] [--open]
  velox check <input.vx|dir>
  velox deploy <project-dir> [--target local|vercel|netlify|cloudflare-pages] [--name app] [--build-out dist] [--deploy-out .velox/deployments]
  velox preview [dir] [--port 4173] [--open] [--no-spa]
  velox deployments [project-dir] [--json]
`);
}

main();
