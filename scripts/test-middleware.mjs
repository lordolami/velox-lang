import assert from "node:assert/strict";
import { composeMiddleware } from "../src/middleware.mjs";

const calls = [];
const run = composeMiddleware([
  async (ctx, next) => {
    calls.push("m1:before");
    ctx.x = 1;
    const r = await next();
    calls.push("m1:after");
    return r;
  },
  async (ctx, next) => {
    calls.push("m2:before");
    ctx.y = ctx.x + 1;
    const r = await next();
    calls.push("m2:after");
    return r;
  },
]);

const result = await run({}, async () => {
  calls.push("handler");
  return { ok: true };
});

assert.equal(result.ok, true);
assert.deepEqual(calls, ["m1:before", "m2:before", "handler", "m2:after", "m1:after"]);

const short = composeMiddleware([
  async () => ({ status: 401 }),
  async () => ({ status: 200 }),
]);
const shortRes = await short({}, async () => ({ status: 204 }));
assert.equal(shortRes.status, 401);

console.log("test-middleware pass");
