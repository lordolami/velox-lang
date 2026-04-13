import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export interface DeployLocalOptions {
  sourceDir: string;
  appName: string;
  deployRoot?: string;
}

export interface DeployResult {
  target: "local" | CloudDeployTarget;
  deploymentId: string;
  outputDir: string;
  manifestPath: string;
  instructionsPath?: string;
}

export interface LocalDeploymentInfo {
  deploymentId: string;
  appName: string;
  outputDir: string;
  manifestPath: string;
  deployedAt: string;
}

export type CloudDeployTarget = "vercel" | "netlify" | "cloudflare-pages";

export interface DeployCloudOptions {
  sourceDir: string;
  appName: string;
  target: CloudDeployTarget;
  deployRoot?: string;
}

export function deployLocalBuild(options: DeployLocalOptions): DeployResult {
  const sourceDir = resolve(options.sourceDir);
  ensureBuildExists(sourceDir);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const appName = sanitizeAppName(options.appName);
  const deploymentId = `${appName}-${timestamp}`;
  const deployRoot = resolve(options.deployRoot ?? join(process.cwd(), ".velox", "deployments"));
  const outputDir = join(deployRoot, deploymentId);
  mkdirSync(outputDir, { recursive: true });

  copyDirectory(sourceDir, outputDir);

  const manifestPath = join(outputDir, "velox-deploy.json");
  writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        version: 1,
        deploymentId,
        appName,
        sourceDir,
        deployedAt: new Date().toISOString(),
        manifest: existsSync(join(sourceDir, "velox-manifest.json"))
          ? JSON.parse(readFileSync(join(sourceDir, "velox-manifest.json"), "utf8"))
          : null,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
  upsertDeploymentRegistry(deployRoot, manifestPath);

  return {
    target: "local",
    deploymentId,
    outputDir,
    manifestPath,
  };
}

export function deployCloudBuild(options: DeployCloudOptions): DeployResult {
  const sourceDir = resolve(options.sourceDir);
  ensureBuildExists(sourceDir);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const appName = sanitizeAppName(options.appName);
  const deploymentId = `${appName}-${timestamp}`;
  const deployRoot = resolve(
    options.deployRoot ?? join(process.cwd(), ".velox", "cloud-deployments", options.target),
  );
  const outputDir = join(deployRoot, deploymentId);
  mkdirSync(outputDir, { recursive: true });

  copyDirectory(sourceDir, outputDir);
  writeCloudTargetFiles(outputDir, options.target, appName);

  const instructionsPath = join(outputDir, "DEPLOY.md");
  writeFileSync(
    instructionsPath,
    buildCloudInstructions({
      target: options.target,
      appName,
      outputDir,
    }),
    "utf8",
  );

  const manifestPath = join(outputDir, "velox-cloud-deploy.json");
  writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        version: 1,
        deploymentId,
        target: options.target,
        appName,
        sourceDir,
        outputDir,
        deployedAt: new Date().toISOString(),
        instructionsPath,
        manifest: existsSync(join(sourceDir, "velox-manifest.json"))
          ? JSON.parse(readFileSync(join(sourceDir, "velox-manifest.json"), "utf8"))
          : null,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );

  return {
    target: options.target,
    deploymentId,
    outputDir,
    manifestPath,
    instructionsPath,
  };
}

export function listLocalDeployments(deployRoot: string): LocalDeploymentInfo[] {
  const root = resolve(deployRoot);
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    return [];
  }
  const out: LocalDeploymentInfo[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const outputDir = join(root, entry.name);
    const manifestPath = join(outputDir, "velox-deploy.json");
    if (!existsSync(manifestPath)) {
      continue;
    }
    try {
      const parsed = JSON.parse(readFileSync(manifestPath, "utf8"));
      if (
        !parsed ||
        typeof parsed !== "object" ||
        typeof parsed.deploymentId !== "string" ||
        typeof parsed.appName !== "string" ||
        typeof parsed.deployedAt !== "string"
      ) {
        continue;
      }
      out.push({
        deploymentId: parsed.deploymentId,
        appName: parsed.appName,
        outputDir,
        manifestPath,
        deployedAt: parsed.deployedAt,
      });
    } catch {
      // Ignore malformed manifest files.
    }
  }
  out.sort((a, b) => b.deployedAt.localeCompare(a.deployedAt));
  return out;
}

function ensureBuildExists(sourceDir: string): void {
  if (!existsSync(sourceDir) || !statSync(sourceDir).isDirectory()) {
    throw new Error(`Build output directory not found: ${sourceDir}`);
  }
  const entries = readdirSync(sourceDir);
  if (entries.length === 0) {
    throw new Error(`Build output directory is empty: ${sourceDir}`);
  }
}

function copyDirectory(sourceDir: string, targetDir: string): void {
  mkdirSync(targetDir, { recursive: true });
  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    const source = join(sourceDir, entry.name);
    const target = join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(source, target);
      continue;
    }
    if (entry.isFile()) {
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(source, target);
    }
  }
}

function writeCloudTargetFiles(outputDir: string, target: CloudDeployTarget, appName: string): void {
  if (target === "vercel") {
    writeFileSync(
      join(outputDir, "vercel.json"),
      JSON.stringify(
        {
          cleanUrls: true,
          trailingSlash: false,
          rewrites: [{ source: "/(.*)", destination: "/index.html" }],
          headers: [
            {
              source: "/(.*).wasm",
              headers: [{ key: "Content-Type", value: "application/wasm" }],
            },
          ],
        },
        null,
        2,
      ) + "\n",
      "utf8",
    );
    return;
  }

  if (target === "netlify") {
    writeFileSync(
      join(outputDir, "netlify.toml"),
      [
        "[build]",
        'publish = "."',
        "",
        "[[redirects]]",
        'from = "/*"',
        'to = "/index.html"',
        "status = 200",
        "",
        "[[headers]]",
        'for = "/*.wasm"',
        "  [headers.values]",
        '  Content-Type = "application/wasm"',
        "",
      ].join("\n"),
      "utf8",
    );
    return;
  }

  if (target === "cloudflare-pages") {
    writeFileSync(
      join(outputDir, "_headers"),
      ["/*.wasm", "  Content-Type: application/wasm", ""].join("\n"),
      "utf8",
    );
    writeFileSync(join(outputDir, "_redirects"), "/* /index.html 200\n", "utf8");
    writeFileSync(
      join(outputDir, "wrangler.toml.example"),
      [
        'name = "velox-app"',
        `project_name = "${appName}"`,
        'compatibility_date = "2026-04-13"',
        "",
      ].join("\n"),
      "utf8",
    );
  }
}

function buildCloudInstructions(input: {
  target: CloudDeployTarget;
  appName: string;
  outputDir: string;
}): string {
  const common = [
    "# Velox Cloud Deploy Instructions",
    "",
    `App: ${input.appName}`,
    `Target: ${input.target}`,
    `Output: ${input.outputDir}`,
    "",
    "This folder is already build-ready. Run one of the commands below from this folder:",
    "",
  ];

  if (input.target === "vercel") {
    return [
      ...common,
      "```bash",
      "npx vercel --prod",
      "```",
      "",
      "If Vercel asks for framework, choose `Other`.",
      "",
    ].join("\n");
  }
  if (input.target === "netlify") {
    return [
      ...common,
      "```bash",
      "npx netlify-cli deploy --prod --dir .",
      "```",
      "",
    ].join("\n");
  }
  return [
    ...common,
    "```bash",
    `npx wrangler pages deploy . --project-name ${input.appName}`,
    "```",
    "",
  ].join("\n");
}

function sanitizeAppName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "velox-app";
}

function upsertDeploymentRegistry(deployRoot: string, manifestPath: string): void {
  const registryPath = join(deployRoot, "index.json");
  const items = existsSync(registryPath)
    ? safeParseRegistry(readFileSync(registryPath, "utf8"))
    : [];
  let parsed: {
    deploymentId: string;
    appName: string;
    outputDir: string;
    manifestPath: string;
    deployedAt: string;
  } | null = null;
  try {
    const raw = JSON.parse(readFileSync(manifestPath, "utf8"));
    if (
      raw &&
      typeof raw === "object" &&
      typeof raw.deploymentId === "string" &&
      typeof raw.appName === "string" &&
      typeof raw.deployedAt === "string"
    ) {
      parsed = {
        deploymentId: raw.deploymentId,
        appName: raw.appName,
        outputDir: dirname(manifestPath),
        manifestPath,
        deployedAt: raw.deployedAt,
      };
    }
  } catch {
    parsed = null;
  }
  if (!parsed) {
    return;
  }
  const filtered = items.filter((item) => item.deploymentId !== parsed!.deploymentId);
  filtered.push(parsed);
  filtered.sort((a, b) => b.deployedAt.localeCompare(a.deployedAt));
  writeFileSync(registryPath, JSON.stringify(filtered, null, 2) + "\n", "utf8");
}

function safeParseRegistry(raw: string): Array<{
  deploymentId: string;
  appName: string;
  outputDir: string;
  manifestPath: string;
  deployedAt: string;
}> {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof item.deploymentId === "string" &&
        typeof item.appName === "string" &&
        typeof item.outputDir === "string" &&
        typeof item.manifestPath === "string" &&
        typeof item.deployedAt === "string",
    );
  } catch {
    return [];
  }
}
