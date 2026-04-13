const { mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const { performance } = require("node:perf_hooks");
const { pathToFileURL } = require("node:url");
const { LspTestClient } = require("./test-client.cjs");

const THRESHOLDS = {
  maxInitializeMs: 2500,
  maxColdCompletionMs: 1200,
  maxWarmCompletionMs: 350,
  maxWorkspaceSymbolMs: 1200,
  maxDefinitionMs: 800,
  maxSemanticTokensMs: 1200,
};

async function main() {
  const workspace = mkdtempSync(join(tmpdir(), "velox-lsp-perf-"));
  const serverPath = resolve(__dirname, "server.js");
  const client = new LspTestClient(serverPath, { cwd: resolve(__dirname, "..", "..", "..") });

  const moduleCount = 140;
  const modules = [];
  for (let i = 0; i < moduleCount; i++) {
    const filePath = join(workspace, `mod${i}.vx`);
    const text = [
      `component C${i}(name) {`,
      `  ~state${i} = { count: ${i}, tag: "m${i}" }`,
      "  render { <p>{name}</p> }",
      "}",
      "",
    ].join("\n");
    writeFileSync(filePath, text, "utf8");
    modules.push({ filePath, text });
  }

  const libPath = join(workspace, "lib.vx");
  const libText = [
    "@fast inc(a: i32) -> i32 {",
    "  a + 1",
    "}",
    "",
  ].join("\n");
  writeFileSync(libPath, libText, "utf8");

  const mainPath = join(workspace, "main.vx");
  const mainText = [
    'import { inc as plusOne } from "./lib.vx"',
    "component App(name) {",
    "  ~value = plusOne(1)",
    "  render { <div>{name}:{value}</div> }",
    "}",
    "",
  ].join("\n");
  writeFileSync(mainPath, mainText, "utf8");

  const workspaceUri = toUri(workspace);
  const mainUri = toUri(mainPath);
  const valueUsagePos = indexToPosition(mainText, mainText.lastIndexOf("{value}") + 1);
  const completionPos = { line: 0, character: 0 };

  try {
    await client.start();

    const initStart = performance.now();
    await client.request("initialize", {
      processId: process.pid,
      rootUri: workspaceUri,
      capabilities: {},
      workspaceFolders: [{ uri: workspaceUri, name: "workspace" }],
    });
    const initializeMs = performance.now() - initStart;
    client.notify("initialized", {});

    client.notify("textDocument/didOpen", {
      textDocument: {
        uri: mainUri,
        languageId: "velox",
        version: 1,
        text: mainText,
      },
    });

    const coldCompletionMs = await measure(async () => {
      const completion = await client.request("textDocument/completion", {
        textDocument: { uri: mainUri },
        position: completionPos,
      });
      const items = Array.isArray(completion)
        ? completion
        : Array.isArray(completion && completion.items)
          ? completion.items
          : [];
      if (items.length === 0) {
        throw new Error("Completion returned no items during perf test.");
      }
    });

    const warmRuns = [];
    for (let i = 0; i < 5; i++) {
      // eslint-disable-next-line no-await-in-loop
      const ms = await measure(async () => {
        await client.request("textDocument/completion", {
          textDocument: { uri: mainUri },
          position: completionPos,
        });
      });
      warmRuns.push(ms);
    }
    const warmCompletionMs = percentile(warmRuns, 0.5);

    const workspaceSymbolMs = await measure(async () => {
      const symbols = await client.request("workspace/symbol", { query: "C13" });
      if (!Array.isArray(symbols) || symbols.length === 0) {
        throw new Error("Workspace symbol returned no results during perf test.");
      }
    });

    const definitionMs = await measure(async () => {
      const definition = await client.request("textDocument/definition", {
        textDocument: { uri: mainUri },
        position: valueUsagePos,
      });
      const resolved = Array.isArray(definition) ? definition[0] : definition;
      const uri = resolved ? resolved.uri || resolved.targetUri : null;
      if (!uri) {
        throw new Error("Definition resolution failed during perf test.");
      }
    });

    const semanticTokensMs = await measure(async () => {
      const semantic = await client.request("textDocument/semanticTokens/full", {
        textDocument: { uri: mainUri },
      });
      if (!semantic || !Array.isArray(semantic.data)) {
        throw new Error("Semantic tokens response invalid during perf test.");
      }
    });

    const measured = {
      moduleCount,
      initializeMs: round(initializeMs),
      coldCompletionMs: round(coldCompletionMs),
      warmCompletionMs: round(warmCompletionMs),
      workspaceSymbolMs: round(workspaceSymbolMs),
      definitionMs: round(definitionMs),
      semanticTokensMs: round(semanticTokensMs),
      warmRunsMs: warmRuns.map(round),
    };
    const failures = [];

    for (const [key, limit] of Object.entries(THRESHOLDS)) {
      const measureKey = key.replace(/^max/, "").replace(/^[A-Z]/, (c) => c.toLowerCase());
      const value = measured[measureKey];
      if (value > limit) {
        failures.push(`${measureKey} ${value}ms > ${limit}ms`);
      }
    }

    const result = {
      suite: "lsp-perf",
      pass: failures.length === 0,
      thresholds: THRESHOLDS,
      measured,
      failures,
    };
    console.log(JSON.stringify(result, null, 2));

    if (failures.length > 0) {
      process.exit(1);
    }

    await client.request("shutdown", null);
    client.notify("exit", null);
  } finally {
    await client.stop();
    rmSync(workspace, { recursive: true, force: true });
  }
}

function toUri(path) {
  return pathToFileURL(path).href;
}

async function measure(fn) {
  const start = performance.now();
  await fn();
  return performance.now() - start;
}

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1))));
  return sorted[idx];
}

function indexToPosition(text, index) {
  let line = 0;
  let character = 0;
  const end = Math.max(0, Math.min(index, text.length));
  for (let i = 0; i < end; i++) {
    if (text[i] === "\n") {
      line++;
      character = 0;
    } else {
      character++;
    }
  }
  return { line, character };
}

function round(value) {
  return Number(value.toFixed(3));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
