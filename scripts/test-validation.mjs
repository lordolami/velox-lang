import assert from "node:assert/strict";
import { validateShape } from "../src/validation.mjs";

const q = validateShape({ page: "int", search: "string?" }, { page: "2" }, "query");
assert.equal(q.value.page, 2);
assert.equal(q.value.search, undefined);

let failed = false;
try {
  validateShape({ page: "int" }, { page: "x" }, "query");
} catch (e) {
  failed = true;
  assert.equal(e.status, 400);
}
assert.equal(failed, true);

console.log("test-validation pass");
