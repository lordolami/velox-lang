import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { runBuild } from "../src/build.mjs";

const distDir = resolve("dist");

await runBuild();
const manifestPath = join(distDir, "fastscript-manifest.json");
assert.equal(existsSync(manifestPath), true, "Missing dist/fastscript-manifest.json");

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

assert.equal(Array.isArray(manifest.routes), true, "manifest.routes must be an array");
assert.equal(Array.isArray(manifest.apiRoutes), true, "manifest.apiRoutes must be an array");
assert.equal(typeof manifest.layout, "string", "manifest.layout must be set");
assert.equal(typeof manifest.notFound, "string", "manifest.notFound must be set");
assert.equal(manifest.routes.length > 0, true, "manifest.routes cannot be empty");
assert.equal(manifest.apiRoutes.length > 0, true, "manifest.apiRoutes cannot be empty");

const routePaths = new Set();
for (const route of manifest.routes) {
  assert.equal(typeof route.path, "string");
  assert.equal(typeof route.module, "string");
  assert.equal(routePaths.has(route.path), false, `duplicate route path: ${route.path}`);
  routePaths.add(route.path);
}

const apiPaths = new Set();
for (const route of manifest.apiRoutes) {
  assert.equal(typeof route.path, "string");
  assert.equal(typeof route.module, "string");
  assert.equal(apiPaths.has(route.path), false, `duplicate api path: ${route.path}`);
  apiPaths.add(route.path);
}

assert.equal(routePaths.has("/"), true, "Missing root route");
assert.equal(apiPaths.has("/api/hello"), true, "Missing /api/hello route");
assert.equal(existsSync(join(distDir, "router.js")), true, "Missing dist/router.js");
assert.equal(existsSync(join(distDir, "index.html")), true, "Missing dist/index.html");

console.log("test-runtime-contract pass");

