import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { runMigrate } from "../src/migrate.mjs";
import { runExport } from "../src/export.mjs";

const root = resolve('.tmp-roundtrip');
const pages = join(root, 'pages');
rmSync(root, { recursive: true, force: true });
mkdirSync(pages, { recursive: true });

writeFileSync(join(pages, 'index.ts'), `
import type { X } from './types'
state n = 1
function add(a: number, b: number): number { return a + b }
export default function Home(){ return '<h1>' + String(add(n,2)) + '</h1>' }
`, 'utf8');

await runMigrate(root);
assert.equal(existsSync(join(pages, 'index.fs')), true);
assert.equal(existsSync(join(pages, 'index.ts')), false);

const appDir = resolve('app');
const restoreDir = mkdtempSync(join(tmpdir(), 'fs-app-backup-'));
const backupApp = join(restoreDir, 'app');

if (existsSync(appDir)) renameSync(appDir, backupApp);

try {
  mkdirSync(join(appDir, 'pages'), { recursive: true });
  writeFileSync(join(appDir, 'pages', 'index.fs'), readFileSync(join(pages, 'index.fs'), 'utf8'), 'utf8');

  await runExport(['--to', 'js', '--out', '.tmp-export-js']);
  await runExport(['--to', 'ts', '--out', '.tmp-export-ts']);
  assert.equal(existsSync(resolve('.tmp-export-js/pages/index.js')), true);
  assert.equal(existsSync(resolve('.tmp-export-ts/pages/index.ts')), true);
} finally {
  rmSync(appDir, { recursive: true, force: true });
  if (existsSync(backupApp)) renameSync(backupApp, appDir);
  rmSync(restoreDir, { recursive: true, force: true });
}

console.log('test-roundtrip pass');
