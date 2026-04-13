import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { get } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { startPreviewServer } from "../src/preview-server";

describe("Velox preview server", () => {
  it("serves static files from output directory", async () => {
    const root = mkdtempSync(join(tmpdir(), "velox-preview-static-"));
    writeFileSync(join(root, "index.html"), "<h1>hello</h1>", "utf8");
    writeFileSync(join(root, "app.js"), "console.log('ok');", "utf8");
    const handle = startPreviewServer({ dir: root, port: 0, spaFallback: true });
    try {
      const html = await httpGet(`${handle.url}/`);
      expect(html.status).toBe(200);
      expect(html.body).toContain("hello");

      const js = await httpGet(`${handle.url}/app.js`);
      expect(js.status).toBe(200);
      expect(js.body).toContain("console.log");
      expect(js.contentType).toContain("text/javascript");
    } finally {
      handle.close();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("supports spa fallback and can disable it", async () => {
    const root = mkdtempSync(join(tmpdir(), "velox-preview-fallback-"));
    mkdirSync(join(root, "nested"), { recursive: true });
    writeFileSync(join(root, "index.html"), "<h1>spa</h1>", "utf8");

    const withFallback = startPreviewServer({ dir: root, port: 0, spaFallback: true });
    try {
      const res = await httpGet(`${withFallback.url}/unknown/route`);
      expect(res.status).toBe(200);
      expect(res.body).toContain("spa");
    } finally {
      withFallback.close();
    }

    const withoutFallback = startPreviewServer({ dir: root, port: 0, spaFallback: false });
    try {
      const res = await httpGet(`${withoutFallback.url}/unknown/route`);
      expect(res.status).toBe(404);
    } finally {
      withoutFallback.close();
      rmSync(root, { recursive: true, force: true });
    }
  });
});

function httpGet(url: string): Promise<{ status: number; body: string; contentType: string }> {
  return new Promise((resolvePromise, reject) => {
    const req = get(url, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      res.on("end", () => {
        resolvePromise({
          status: res.statusCode ?? 0,
          body: Buffer.concat(chunks).toString("utf8"),
          contentType: String(res.headers["content-type"] ?? ""),
        });
      });
    });
    req.on("error", reject);
  });
}

