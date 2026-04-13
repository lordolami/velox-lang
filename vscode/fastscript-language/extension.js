const path = require('node:path');
const vscode = require('vscode');
const { LanguageClient, TransportKind } = require('vscode-languageclient/node');

let client;

function activate(context) {
  const serverModule = context.asAbsolutePath(path.join('lsp', 'server.cjs'));
  const serverOptions = { run: { module: serverModule, transport: TransportKind.ipc }, debug: { module: serverModule, transport: TransportKind.ipc } };
  const clientOptions = { documentSelector: [{ scheme: 'file', language: 'fastscript' }] };
  client = new LanguageClient('fastscript-lsp', 'FastScript Language Server', serverOptions, clientOptions);
  context.subscriptions.push(client.start());
  vscode.languages.setLanguageConfiguration('fastscript', {
    comments: { lineComment: '//' },
    brackets: [['{', '}'], ['[', ']'], ['(', ')']],
  });
}

function deactivate() {
  if (!client) return undefined;
  return client.stop();
}

module.exports = { activate, deactivate };
