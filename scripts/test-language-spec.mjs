import assert from "node:assert/strict";
import {
  FASTSCRIPT_LANGUAGE_SPEC_VERSION,
  compileFastScriptSource,
  getLanguageSpec,
  inspectFastScriptSource,
} from "../src/language-spec.mjs";
import { stripTypeScriptHints } from "../src/fs-normalize.mjs";

const spec = getLanguageSpec();
assert.equal(spec.version, FASTSCRIPT_LANGUAGE_SPEC_VERSION);
assert.equal(Array.isArray(spec.goals), true);
assert.equal(spec.goals.length >= 3, true);

const source = `
~count = 0
state name = "fastscript"
fn add(a, b) {
  return a + b
}
export fn main() {
  return add(count, 1)
}
`;

const compiled = compileFastScriptSource(source, { filename: "example.fs", strict: true });
assert.match(compiled.code, /\blet count = 0/);
assert.match(compiled.code, /\blet name = "fastscript"/);
assert.match(compiled.code, /\bfunction add\(a, b\)/);
assert.equal(compiled.stats.reactiveToLet > 0, true);
assert.equal(compiled.stats.stateToLet > 0, true);
assert.equal(compiled.stats.fnToFunction > 0, true);

const dupReport = inspectFastScriptSource(
  `
~count = 1
state count = 2
`,
  { filename: "dup.fs" },
);
assert.equal(dupReport.ok, true);
assert.equal(dupReport.diagnostics.some((d) => d.code === "FS_DUP_STATE"), true);

let strictFailed = false;
try {
  compileFastScriptSource('import {} from "./x.fs"\n~a = 1', { filename: "bad.fs", strict: true });
} catch (error) {
  strictFailed = true;
  assert.equal(error.code, "FASTSCRIPT_DIAGNOSTICS");
  assert.match(String(error.message), /FS_EMPTY_IMPORT/);
}
assert.equal(strictFailed, true);

const stripped = stripTypeScriptHints(`
type User = { id: string }
const age: number = 2
function sum(a: number, b: number): number { return a + b }
`);
assert.match(stripped, /const age = 2/);
assert.match(stripped, /function sum\(a, b\)/);

console.log("test-language-spec pass");
