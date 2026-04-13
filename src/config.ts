import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

export interface VeloxConfig {
  build?: {
    outDir?: string;
    copyPublic?: boolean;
    router?: {
      enabled?: boolean;
      title?: string;
    };
  };
  dev?: {
    outDir?: string;
    port?: number;
    open?: boolean;
    copyPublic?: boolean;
    router?: {
      enabled?: boolean;
      title?: string;
    };
  };
  deploy?: {
    target?: "local" | "vercel" | "netlify" | "cloudflare-pages";
    outputDir?: string;
    appName?: string;
    buildInput?: string;
    buildOutDir?: string;
  };
}

export interface LoadedVeloxConfig {
  path: string | null;
  config: VeloxConfig;
}

export function loadVeloxConfig(startDir: string): LoadedVeloxConfig {
  const path = findConfigPath(startDir);
  if (!path) {
    return { path: null, config: {} };
  }
  const raw = readFileSync(path, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid velox.config.json at ${path}: ${message}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Invalid velox.config.json at ${path}: expected JSON object`);
  }
  return { path, config: parsed as VeloxConfig };
}

function findConfigPath(startDir: string): string | null {
  let current = resolve(startDir);
  while (true) {
    const candidate = join(current, "velox.config.json");
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

export function resolveConfigPathValue(baseDir: string, value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  if (isAbsolute(value)) {
    return value;
  }
  return resolve(baseDir, value);
}
