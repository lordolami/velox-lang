const path = require("node:path");
const { existsSync } = require("node:fs");
const { exec } = require("node:child_process");
const vscode = require("vscode");

let client = null;

function activate(context) {
  startLanguageServerClient(context);
  registerCliDiagnostics(context);
  registerFileDecorations(context);
}

async function deactivate() {
  if (client) {
    const running = client;
    client = null;
    await running.stop();
  }
}

function startLanguageServerClient(context) {
  let lsp;
  try {
    // eslint-disable-next-line global-require
    lsp = require("vscode-languageclient/node");
  } catch {
    vscode.window.showWarningMessage(
      "Velox LSP dependencies are missing. Run npm install in vscode/velox-language to enable full language intelligence.",
    );
    return;
  }

  const bundledServerModule = context.asAbsolutePath(path.join("dist", "lsp", "server.js"));
  const sourceServerModule = context.asAbsolutePath(path.join("lsp", "server.js"));
  const serverModule = existsSync(bundledServerModule) ? bundledServerModule : sourceServerModule;
  const serverOptions = {
    run: { module: serverModule, transport: lsp.TransportKind.ipc },
    debug: { module: serverModule, transport: lsp.TransportKind.ipc },
  };

  const clientOptions = {
    documentSelector: [{ scheme: "file", language: "velox" }],
    synchronize: {
      fileEvents: [
        vscode.workspace.createFileSystemWatcher("**/*.vx"),
        vscode.workspace.createFileSystemWatcher("**/*.VX"),
      ],
    },
  };

  client = new lsp.LanguageClient("veloxLsp", "Velox Language Server", serverOptions, clientOptions);
  context.subscriptions.push(client.start());
}

function registerCliDiagnostics(context) {
  const diagnostics = vscode.languages.createDiagnosticCollection("velox");
  context.subscriptions.push(diagnostics);

  const runCheckCommand = vscode.commands.registerCommand("velox.checkCurrentFile", async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== "velox") {
      vscode.window.showInformationMessage("Open a .vx file to run Velox check.");
      return;
    }
    await validateDocument(editor.document, diagnostics, true);
  });
  context.subscriptions.push(runCheckCommand);

  const debounced = new Map();
  const maybeValidate = (document) => {
    if (document.languageId !== "velox" || document.uri.scheme !== "file") {
      return;
    }
    scheduleValidation(debounced, document.uri.toString(), () => validateDocument(document, diagnostics, false));
  };

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(maybeValidate),
    vscode.workspace.onDidSaveTextDocument(maybeValidate),
    vscode.workspace.onDidCloseTextDocument((document) => diagnostics.delete(document.uri)),
  );

  for (const doc of vscode.workspace.textDocuments) {
    maybeValidate(doc);
  }
}

function registerFileDecorations(context) {
  const provider = {
    provideFileDecoration(uri) {
      if (!uri || uri.scheme !== "file") {
        return;
      }
      if (!isVxFsPath(uri.fsPath)) {
        return;
      }
      return new vscode.FileDecoration("VX", "Velox file", new vscode.ThemeColor("charts.blue"));
    },
  };
  context.subscriptions.push(vscode.window.registerFileDecorationProvider(provider));
}

async function validateDocument(document, diagnostics, showResult) {
  const cfg = vscode.workspace.getConfiguration();
  const enabled = cfg.get("velox.diagnostics.enabled", true);
  if (!enabled) {
    diagnostics.delete(document.uri);
    return;
  }

  const target = quoteArg(document.uri.fsPath);
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
  const cwd = workspaceFolder ? workspaceFolder.uri.fsPath : path.dirname(document.uri.fsPath);
  const configuredCliPath = cfg.get("velox.cliPath", "").trim();

  const candidates = [];
  if (configuredCliPath) {
    candidates.push(`${quoteArg(configuredCliPath)} check ${target}`);
  }
  candidates.push(`node dist/cli.js check ${target}`);
  candidates.push(`npx --no-install velox check ${target}`);
  candidates.push(`velox check ${target}`);

  let last = null;
  for (const command of candidates) {
    // eslint-disable-next-line no-await-in-loop
    const result = await runCommand(command, cwd);
    const cmdError = result.error && /(not recognized|not found|ENOENT)/i.test(result.error + result.stderr);
    if (cmdError) {
      last = result;
      continue;
    }
    last = result;
    break;
  }

  if (!last) {
    return;
  }

  if (last.code === 0) {
    diagnostics.delete(document.uri);
    if (showResult) {
      vscode.window.showInformationMessage("Velox check passed.");
    }
    return;
  }

  const output = `${last.stderr}\n${last.stdout}`.trim();
  const parsed = parseVeloxError(output, document);
  diagnostics.set(document.uri, [parsed.diagnostic]);
  if (showResult) {
    vscode.window.showErrorMessage(parsed.message);
  }
}

function parseVeloxError(output, document) {
  const codeMatch = output.match(/\[(VX\d{4})\]/);
  const code = codeMatch ? codeMatch[1] : "VX0000";
  const lineColMatch = output.match(/at\s+(\d+):(\d+)/);
  const message = output.length > 0 ? output.split(/\r?\n/).slice(-1)[0] : "Velox check failed.";

  let range = new vscode.Range(0, 0, 0, 1);
  if (lineColMatch) {
    const line = Math.max(0, Number(lineColMatch[1]) - 1);
    const col = Math.max(0, Number(lineColMatch[2]) - 1);
    const safeLine = Math.min(line, Math.max(0, document.lineCount - 1));
    const text = document.lineAt(safeLine).text;
    const safeCol = Math.min(col, Math.max(0, text.length));
    range = new vscode.Range(safeLine, safeCol, safeLine, Math.min(safeCol + 1, text.length));
  }

  const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Error);
  diagnostic.source = "velox";
  diagnostic.code = code;
  return { diagnostic, message };
}

function runCommand(command, cwd) {
  return new Promise((resolve) => {
    exec(command, { cwd }, (error, stdout, stderr) => {
      resolve({
        code: error && typeof error.code === "number" ? error.code : 0,
        error: error ? String(error.message || error) : "",
        stdout: stdout || "",
        stderr: stderr || "",
      });
    });
  });
}

function quoteArg(value) {
  if (/\s/.test(value) || /"/.test(value)) {
    return `"${value.replaceAll('"', '\\"')}"`;
  }
  return value;
}

function isVxFsPath(filePath) {
  return path.extname(filePath).toLowerCase() === ".vx";
}

function scheduleValidation(map, key, fn) {
  const existing = map.get(key);
  if (existing) {
    clearTimeout(existing);
  }
  const timer = setTimeout(() => {
    map.delete(key);
    Promise.resolve(fn()).catch(() => {});
  }, 250);
  map.set(key, timer);
}

module.exports = {
  activate,
  deactivate,
};
