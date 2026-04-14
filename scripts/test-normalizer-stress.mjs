import assert from "node:assert/strict";
import { compileFastScriptSource } from "../src/language-spec.mjs";

function bigProgram(lineCount = 12000) {
  const out = [];
  for (let i = 0; i < lineCount; i += 1) {
    if (i % 7 === 0) out.push(`~count_${i} = ${i}`);
    else if (i % 11 === 0) out.push(`state title_${i} = "v${i}"`);
    else if (i % 13 === 0) out.push(`fn add_${i}(a, b) { return a + b + ${i} }`);
    else out.push(`const v_${i} = ${i}`);
  }
  return out.join("\n");
}

const source = bigProgram();
const result = compileFastScriptSource(source, { filename: "stress.fs", strict: false });

assert.equal(result.stats.lineCount >= 12000, true);
assert.equal(result.stats.durationMs < 5000, true, `normalizer stress too slow: ${result.stats.durationMs.toFixed(2)}ms`);
assert.equal(result.code.includes("let count_0 = 0"), true);

console.log(`test-normalizer-stress pass: ${result.stats.durationMs.toFixed(2)}ms`);

