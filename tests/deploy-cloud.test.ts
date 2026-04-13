import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { compileProject } from "../src/compiler";
import { deployCloudBuild } from "../src/deploy";

describe("Velox cloud deploy bundles", () => {
  function createBuildFixture(): { root: string; srcDir: string; buildDir: string } {
    const root = mkdtempSync(join(tmpdir(), "velox-cloud-deploy-"));
    const srcDir = join(root, "src");
    const pagesDir = join(srcDir, "pages");
    mkdirSync(pagesDir, { recursive: true });
    writeFileSync(
      join(pagesDir, "index.vx"),
      `component Home { render { <h1>home</h1> } }`,
      "utf8",
    );
    const buildDir = join(root, "dist");
    compileProject({ inputPath: srcDir, outputDir: buildDir });
    return { root, srcDir, buildDir };
  }

  it("creates a vercel-ready deployment bundle", () => {
    const { root, buildDir } = createBuildFixture();
    const deployRoot = join(root, ".velox", "cloud", "vercel");
    try {
      const result = deployCloudBuild({
        sourceDir: buildDir,
        appName: "vercel-app",
        target: "vercel",
        deployRoot,
      });
      expect(result.target).toBe("vercel");
      expect(existsSync(join(result.outputDir, "vercel.json"))).toBe(true);
      expect(existsSync(result.instructionsPath!)).toBe(true);
      const manifest = JSON.parse(readFileSync(result.manifestPath, "utf8"));
      expect(manifest.target).toBe("vercel");
      expect(manifest.appName).toBe("vercel-app");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("creates a netlify-ready deployment bundle", () => {
    const { root, buildDir } = createBuildFixture();
    const deployRoot = join(root, ".velox", "cloud", "netlify");
    try {
      const result = deployCloudBuild({
        sourceDir: buildDir,
        appName: "netlify-app",
        target: "netlify",
        deployRoot,
      });
      expect(result.target).toBe("netlify");
      expect(existsSync(join(result.outputDir, "netlify.toml"))).toBe(true);
      const instructions = readFileSync(result.instructionsPath!, "utf8");
      expect(instructions).toMatch(/netlify-cli/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("creates a cloudflare-pages-ready deployment bundle", () => {
    const { root, buildDir } = createBuildFixture();
    const deployRoot = join(root, ".velox", "cloud", "cloudflare-pages");
    try {
      const result = deployCloudBuild({
        sourceDir: buildDir,
        appName: "cf-pages-app",
        target: "cloudflare-pages",
        deployRoot,
      });
      expect(result.target).toBe("cloudflare-pages");
      expect(existsSync(join(result.outputDir, "_headers"))).toBe(true);
      expect(existsSync(join(result.outputDir, "_redirects"))).toBe(true);
      expect(existsSync(join(result.outputDir, "wrangler.toml.example"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

