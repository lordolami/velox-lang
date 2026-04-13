import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { initProject } from "../src/scaffold";

describe("Velox scaffold", () => {
  it("creates pages template project files", () => {
    const dir = mkdtempSync(join(tmpdir(), "velox-init-pages-"));
    try {
      const result = initProject({ targetDir: dir, template: "pages" });
      expect(result.files.length).toBeGreaterThan(0);
      expect(existsSync(join(dir, "velox.config.json"))).toBe(true);
      expect(existsSync(join(dir, "pages", "index.vx"))).toBe(true);
      expect(existsSync(join(dir, "pages", "_layout.vx"))).toBe(true);
      expect(existsSync(join(dir, "public", "robots.txt"))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("creates single template project files", () => {
    const dir = mkdtempSync(join(tmpdir(), "velox-init-single-"));
    try {
      initProject({ targetDir: dir, template: "single" });
      expect(existsSync(join(dir, "app.vx"))).toBe(true);
      expect(existsSync(join(dir, "pages"))).toBe(false);
      const pkg = readFileSync(join(dir, "package.json"), "utf8");
      expect(pkg).toContain('"scripts"');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails when target directory is non-empty unless --force is used", () => {
    const dir = mkdtempSync(join(tmpdir(), "velox-init-force-"));
    try {
      const markerPath = join(dir, "existing.txt");
      // Create one file to make directory non-empty.
      writeFileSync(markerPath, "x", "utf8");
      expect(() => initProject({ targetDir: dir, template: "pages" })).toThrow(/not empty/i);
      expect(() => initProject({ targetDir: dir, template: "pages", force: true })).not.toThrow();
      expect(readdirSync(dir).length).toBeGreaterThan(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
