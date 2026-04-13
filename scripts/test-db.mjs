import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { resolve } from "node:path";
import { createFileDatabase } from "../src/db.mjs";

const dir = resolve('.tmp-db-tests');
rmSync(dir, { recursive: true, force: true });

const db = createFileDatabase({ dir, name: 'test' });
const users = db.collection('users');
users.set('u1', { id: 'u1', role: 'admin', active: true });
users.upsert('u2', () => ({ id: 'u2', role: 'user', active: false }));

assert.equal(users.get('u1').role, 'admin');
assert.equal(users.first((u) => u.id === 'u2').id, 'u2');
assert.equal(users.where({ role: 'admin' }).length, 1);
assert.equal(db.where('users', { active: false }).length, 1);

let rolledBack = false;
try {
  db.transaction((tx) => {
    tx.collection('users').set('u3', { id: 'u3' });
    throw new Error('boom');
  });
} catch {
  rolledBack = true;
}
assert.equal(rolledBack, true);
assert.equal(users.get('u3'), null);

console.log('test-db pass');
