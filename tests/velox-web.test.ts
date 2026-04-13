import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { compileProject } from "../src/compiler";
import { deployCloudBuild } from "../src/deploy";

describe("Velox web app hardening", () => {
  it("compiles apps/velox-web with router artifacts and data files", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-web-compile-"));
    const outputDir = join(root, "dist");
    const appDir = resolve("apps", "velox-web");

    try {
      const result = compileProject({ inputPath: appDir, outputDir });
      expect(result.outputPaths.length).toBeGreaterThanOrEqual(10);
      expect(existsSync(join(outputDir, "index.html"))).toBe(true);
      expect(existsSync(join(outputDir, "__velox_router.js"))).toBe(true);
      expect(existsSync(join(outputDir, "pages", "index.data.js"))).toBe(true);
      expect(existsSync(join(outputDir, "pages", "benchmarks.data.js"))).toBe(true);
      expect(existsSync(join(outputDir, "pages", "docs", "index.data.js"))).toBe(true);

      const manifest = JSON.parse(readFileSync(join(outputDir, "velox-manifest.json"), "utf8"));
      expect(manifest.router.routeCount).toBeGreaterThanOrEqual(8);
      expect(manifest.files.routeData).toContain("pages/index.data.js");
      expect(manifest.files.routeData).toContain("pages/benchmarks.data.js");
      expect(manifest.files.routeData).toContain("pages/docs/index.data.js");
      expect(manifest.files.public).toContain("styles/global.css");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("creates cloud-ready deploy bundles for velox-web", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-web-deploy-"));
    const outputDir = join(root, "dist");
    const appDir = resolve("apps", "velox-web");

    try {
      compileProject({ inputPath: appDir, outputDir });

      const vercel = deployCloudBuild({
        sourceDir: outputDir,
        appName: "velox-web",
        target: "vercel",
        deployRoot: join(root, "deploy", "vercel"),
      });
      const netlify = deployCloudBuild({
        sourceDir: outputDir,
        appName: "velox-web",
        target: "netlify",
        deployRoot: join(root, "deploy", "netlify"),
      });
      const cloudflare = deployCloudBuild({
        sourceDir: outputDir,
        appName: "velox-web",
        target: "cloudflare-pages",
        deployRoot: join(root, "deploy", "cloudflare-pages"),
      });

      expect(existsSync(join(vercel.outputDir, "vercel.json"))).toBe(true);
      expect(existsSync(join(netlify.outputDir, "netlify.toml"))).toBe(true);
      expect(existsSync(join(cloudflare.outputDir, "_headers"))).toBe(true);
      expect(existsSync(join(cloudflare.outputDir, "_redirects"))).toBe(true);
      expect(existsSync(vercel.instructionsPath ?? "")).toBe(true);
      expect(existsSync(netlify.instructionsPath ?? "")).toBe(true);
      expect(existsSync(cloudflare.instructionsPath ?? "")).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

