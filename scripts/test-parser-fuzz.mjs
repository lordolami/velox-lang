import assert from "node:assert/strict";
import { compileFastScriptSource, inspectFastScriptSource } from "../src/language-spec.mjs";

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function id() {
  const roots = ["count", "value", "name", "idx", "row", "state", "alpha", "beta"];
  return `${pick(roots)}_${Math.floor(Math.random() * 100)}`;
}

function makeProgram(lines = 24) {
  const out = [];
  for (let i = 0; i < lines; i += 1) {
    const k = Math.floor(Math.random() * 10);
    if (k <= 2) out.push(`~${id()} = ${Math.floor(Math.random() * 100)}`);
    else if (k <= 4) out.push(`state ${id()} = "${id()}"`);
    else if (k === 5) out.push(`fn ${id()}(a, b) { return a + b }`);
    else if (k === 6) out.push(`const ${id()} = ${Math.floor(Math.random() * 100)}`);
    else if (k === 7) out.push(`import { x } from "./lib.fs"`);
    else if (k === 8) out.push(`if (true) {}`);
    else out.push(`// comment ${id()}`);
  }
  return out.join("\n");
}

for (let i = 0; i < 700; i += 1) {
  const input = makeProgram(8 + Math.floor(Math.random() * 32));
  const report = inspectFastScriptSource(input, { filename: `fuzz-${i}.fs` });
  assert.equal(Array.isArray(report.diagnostics), true);

  const built = compileFastScriptSource(input, { filename: `fuzz-${i}.fs`, strict: false });
  assert.equal(typeof built.code, "string");
  assert.equal(typeof built.stats.durationMs, "number");
}

const knownGood = [
  `~count = 0\nfn inc() { count = count + 1 }\nexport fn read(){ return count }`,
  `state name = "fast"\nfn greet(n){ return n + name }`,
  `import x from "./a.js"\n~ready = true\nif (ready) {}`,
];
for (const sample of knownGood) {
  const out = compileFastScriptSource(sample, { filename: "sample.fs", strict: true });
  assert.equal(typeof out.code, "string");
}

console.log("test-parser-fuzz pass");

