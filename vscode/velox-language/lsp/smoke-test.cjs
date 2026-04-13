const { mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const { pathToFileURL } = require("node:url");
const { LspTestClient } = require("./test-client.cjs");

async function main() {
  const workspace = mkdtempSync(join(tmpdir(), "velox-lsp-smoke-"));
  const serverPath = resolve(__dirname, "server.js");
  const client = new LspTestClient(serverPath, { cwd: resolve(__dirname, "..", "..", "..") });

  const libPath = join(workspace, "lib.vx");
  const mainPath = join(workspace, "main.vx");
  const badPath = join(workspace, "bad.vx");
  const importPathFile = join(workspace, "import-path.vx");

  const libText = [
    "@fast inc(a: i32) -> i32 {",
    "  a + 1",
    "}",
    "",
    "component Button {",
    "  render { <button>ok</button> }",
    "}",
    "",
  ].join("\n");
  const mainText = [
    'import { inc as plusOne, Button } from "./lib.vx"',
    "component App(name) {",
    "  ~value = plusOne(1)",
    "  render { <div>{name}:{value}</div> }",
    "}",
    "",
  ].join("\n");
  const badText = [
    'import { inc } from "./lib.js"',
    "component Broken {",
    "  render { <p>broken</p> }",
    "}",
    "",
  ].join("\n");
  const importPathText = [
    'import { inc } from "./"',
    "component ImportPath {",
    "  render { <p>ok</p> }",
    "}",
    "",
  ].join("\n");

  writeFileSync(libPath, libText, "utf8");
  writeFileSync(mainPath, mainText, "utf8");
  writeFileSync(badPath, badText, "utf8");
  writeFileSync(importPathFile, importPathText, "utf8");

  const workspaceUri = toUri(workspace);
  const libUri = toUri(libPath);
  const mainUri = toUri(mainPath);
  const badUri = toUri(badPath);
  const importPathUri = toUri(importPathFile);
  const valueUsagePos = indexToPosition(mainText, mainText.lastIndexOf("{value}") + 1);

  try {
    await client.start();
    await client.request("initialize", {
      processId: process.pid,
      rootUri: workspaceUri,
      capabilities: {},
      workspaceFolders: [{ uri: workspaceUri, name: "workspace" }],
    });
    client.notify("initialized", {});

    client.notify("textDocument/didOpen", {
      textDocument: {
        uri: libUri,
        languageId: "velox",
        version: 1,
        text: libText,
      },
    });
    client.notify("textDocument/didOpen", {
      textDocument: {
        uri: mainUri,
        languageId: "velox",
        version: 1,
        text: mainText,
      },
    });
    client.notify("textDocument/didOpen", {
      textDocument: {
        uri: badUri,
        languageId: "velox",
        version: 1,
        text: badText,
      },
    });
    client.notify("textDocument/didOpen", {
      textDocument: {
        uri: importPathUri,
        languageId: "velox",
        version: 1,
        text: importPathText,
      },
    });

    await sleep(300);

    const completionResult = await client.request("textDocument/completion", {
      textDocument: { uri: mainUri },
      position: { line: 0, character: 0 },
    });
    const completion = Array.isArray(completionResult)
      ? completionResult
      : Array.isArray(completionResult && completionResult.items)
        ? completionResult.items
        : [];
    assert(completion.length > 0, "Expected completion items.");
    assert(completion.some((item) => item.label === "component"), "Expected base keyword completion.");

    const importPathCompletionResult = await client.request("textDocument/completion", {
      textDocument: { uri: importPathUri },
      position: indexToPosition(importPathText, importPathText.indexOf('./"') + 2),
    });
    const importPathCompletion = Array.isArray(importPathCompletionResult)
      ? importPathCompletionResult
      : Array.isArray(importPathCompletionResult && importPathCompletionResult.items)
        ? importPathCompletionResult.items
        : [];
    assert(
      importPathCompletion.some((item) => String(item.label).includes("./lib")),
      "Expected import path completion to suggest ./lib",
    );

    const definitionResult = await client.request("textDocument/definition", {
      textDocument: { uri: mainUri },
      position: valueUsagePos,
    });
    const definition = Array.isArray(definitionResult) ? definitionResult[0] : definitionResult;
    const definitionUri = definition ? definition.uri || definition.targetUri : null;
    assert(Boolean(definitionUri), "Expected non-empty definition result.");

    const references = await client.request("textDocument/references", {
      textDocument: { uri: mainUri },
      position: valueUsagePos,
      context: { includeDeclaration: true },
    });
    assert(Array.isArray(references) && references.length >= 2, "Expected references across state declaration+usage.");

    const rename = await client.request("textDocument/rename", {
      textDocument: { uri: mainUri },
      position: valueUsagePos,
      newName: "renamedValue",
    });
    assert(rename && rename.changes && rename.changes[mainUri], "Expected rename edits in main.vx.");
    assert(rename.changes[mainUri].length >= 2, "Expected rename to update declaration + usage.");

    const jsStart = badText.indexOf(".js");
    const fakeDiagnostic = {
      range: {
        start: indexToPosition(badText, jsStart),
        end: indexToPosition(badText, jsStart + 3),
      },
      severity: 1,
      source: "velox-lsp",
      code: "VX3021",
      message: "[VX3021] Import uses .js specifier.",
    };
    const codeActions = await client.request("textDocument/codeAction", {
      textDocument: { uri: badUri },
      range: fakeDiagnostic.range,
      context: { diagnostics: [fakeDiagnostic] },
    });
    assert(
      Array.isArray(codeActions) && codeActions.some((action) => action.title.includes(".vx")),
      "Expected quick-fix action for .js -> .vx import.",
    );

    const symbols = await client.request("workspace/symbol", { query: "App" });
    assert(Array.isArray(symbols) && symbols.some((s) => s.name === "App"), "Expected workspace symbol for App.");

    const docSymbols = await client.request("textDocument/documentSymbol", {
      textDocument: { uri: mainUri },
    });
    assert(Array.isArray(docSymbols) && docSymbols.some((s) => s.name === "App"), "Expected document symbol for App.");

    const semantic = await client.request("textDocument/semanticTokens/full", {
      textDocument: { uri: mainUri },
    });
    assert(semantic && Array.isArray(semantic.data) && semantic.data.length > 0, "Expected semantic tokens data.");

    console.log(
      JSON.stringify(
        {
          suite: "lsp-smoke",
          pass: true,
          checks: [
            "completion",
            "importPathCompletion",
            "definition",
            "references",
            "rename",
            "codeAction",
            "workspaceSymbol",
            "documentSymbol",
            "semanticTokens",
          ],
        },
        null,
        2,
      ),
    );

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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
