import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { resolve } from "node:path";
import { createSessionManager, parseCookies, serializeCookie } from "../src/auth.mjs";

const dir = resolve('.tmp-auth-tests');
rmSync(dir, { recursive: true, force: true });

const sm = createSessionManager({ dir, cookieName: 't' });
const token = sm.create({ id: 'u1' }, 60);
assert.ok(token.split('.').length === 3);
assert.equal(sm.read(token).user.id, 'u1');

const rotated = sm.rotate(token, 60);
assert.ok(rotated);
assert.equal(sm.read(token), null);
assert.equal(sm.read(rotated).user.id, 'u1');

sm.delete(rotated);
assert.equal(sm.read(rotated), null);

const c = serializeCookie('a', 'b', { path: '/', maxAge: 10, httpOnly: true });
assert.ok(c.includes('a=b'));
assert.equal(parseCookies('a=b; x=y').x, 'y');

console.log('test-auth pass');
