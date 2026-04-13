import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { compileProject } from "../src/compiler";
import { deployLocalBuild, listLocalDeployments } from "../src/deploy";

describe("Velox deploy", () => {
  it("creates local deployment output and metadata", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-deploy-local-"));
    const srcDir = join(root, "src");
    const pagesDir = join(srcDir, "pages");
    mkdirSync(pagesDir, { recursive: true });
    writeFileSync(join(pagesDir, "index.vx"), `component Home { render { <h1>home</h1> } }`, "utf8");
    const buildDir = join(root, "dist");
    const deployDir = join(root, ".velox", "deployments");
    try {
      compileProject({ inputPath: srcDir, outputDir: buildDir });
      const result = deployLocalBuild({
        sourceDir: buildDir,
        appName: "demo-app",
        deployRoot: deployDir,
      });
      expect(result.deploymentId.startsWith("demo-app-")).toBe(true);
      expect(existsSync(join(result.outputDir, "pages", "index.js"))).toBe(true);
      expect(existsSync(join(result.outputDir, "velox-manifest.json"))).toBe(true);
      expect(existsSync(result.manifestPath)).toBe(true);
      const deployMeta = JSON.parse(readFileSync(result.manifestPath, "utf8"));
      expect(deployMeta.version).toBe(1);
      expect(deployMeta.appName).toBe("demo-app");
      expect(deployMeta.manifest.version).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails deployment when source build dir is missing", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-deploy-missing-"));
    try {
      expect(() =>
        deployLocalBuild({
          sourceDir: join(root, "no-build"),
          appName: "missing",
          deployRoot: join(root, ".velox", "deployments"),
        }),
      ).toThrow(/not found/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("lists local deployments from deploy root", () => {
    const root = mkdtempSync(join(tmpdir(), "velox-deploy-list-"));
    const srcDir = join(root, "src");
    const pagesDir = join(srcDir, "pages");
    mkdirSync(pagesDir, { recursive: true });
    writeFileSync(join(pagesDir, "index.vx"), `component Home { render { <h1>home</h1> } }`, "utf8");
    const buildDir = join(root, "dist");
    const deployDir = join(root, ".velox", "deployments");
    try {
      compileProject({ inputPath: srcDir, outputDir: buildDir });
      const a = deployLocalBuild({
        sourceDir: buildDir,
        appName: "demo-a",
        deployRoot: deployDir,
      });
      const b = deployLocalBuild({
        sourceDir: buildDir,
        appName: "demo-b",
        deployRoot: deployDir,
      });
      const list = listLocalDeployments(deployDir);
      expect(list.length).toBe(2);
      expect(list.some((d) => d.deploymentId === a.deploymentId)).toBe(true);
      expect(list.some((d) => d.deploymentId === b.deploymentId)).toBe(true);
      const registry = JSON.parse(readFileSync(join(deployDir, "index.json"), "utf8"));
      expect(Array.isArray(registry)).toBe(true);
      expect(registry.length).toBe(2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
