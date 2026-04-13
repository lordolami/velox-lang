import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { performance } from "node:perf_hooks";
import { runBuild } from "../src/build.mjs";

function gzipSize(path) {
  if (!existsSync(path)) return 0;
  return gzipSync(readFileSync(path), { level: 9 }).byteLength;
}

function kb(n) {
  return (n / 1024).toFixed(2);
}

const t0 = performance.now();
await runBuild();
const t1 = performance.now();

const dist = resolve('dist');
const manifest = JSON.parse(readFileSync(join(dist, 'fastscript-manifest.json'), 'utf8'));
const jsAssets = [join(dist, 'router.js')];
if (manifest.layout) jsAssets.push(join(dist, manifest.layout.replace(/^\.\//, '')));
const home = manifest.routes.find((r) => r.path === '/');
if (home?.module) jsAssets.push(join(dist, home.module.replace(/^\.\//, '')));
const cssAssets = [join(dist, 'styles.css')];

const js = jsAssets.reduce((s, p) => s + gzipSize(p), 0);
const css = cssAssets.reduce((s, p) => s + gzipSize(p), 0);

const md = `# FastScript Benchmark Report\n\n- Build time: ${(t1 - t0).toFixed(2)}ms\n- Routes: ${manifest.routes.length}\n- API routes: ${manifest.apiRoutes?.length ?? 0}\n- JS first-load gzip: ${kb(js)}KB\n- CSS first-load gzip: ${kb(css)}KB\n\n## Budgets\n- JS budget (30KB): ${js <= 30 * 1024 ? 'PASS' : 'FAIL'}\n- CSS budget (10KB): ${css <= 10 * 1024 ? 'PASS' : 'FAIL'}\n`;

const outDir = resolve('benchmarks');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'latest-report.md'), md, 'utf8');
console.log('bench report written: benchmarks/latest-report.md');
