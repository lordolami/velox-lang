import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { resolve } from "node:path";
import { createJobQueue } from "../src/jobs.mjs";

const dir = resolve('.tmp-jobs-tests');
rmSync(dir, { recursive: true, force: true });
const q = createJobQueue({ dir });
const job = q.enqueue('a', { n: 1 }, { delayMs: 0, maxAttempts: 2, backoffMs: 1 });
assert.equal(q.peekReady(10).length >= 1, true);
q.fail(job);
assert.equal(q.list().length, 1);
q.fail(job);
assert.equal(q.list().length, 0);
console.log('test-jobs pass');
