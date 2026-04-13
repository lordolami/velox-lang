const { createConnection, ProposedFeatures, TextDocuments, DiagnosticSeverity } = require('vscode-languageserver/node');
const { TextDocument } = require('vscode-languageserver-textdocument');

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

connection.onInitialize(() => ({ capabilities: { textDocumentSync: documents.syncKind } }));

documents.onDidChangeContent((change) => {
  const text = change.document.getText();
  const diagnostics = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (line.includes('TODO_ERROR')) {
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        range: { start: { line: i, character: 0 }, end: { line: i, character: line.length } },
        message: 'Remove TODO_ERROR token',
        source: 'fastscript-lsp',
      });
    }
  });
  connection.sendDiagnostics({ uri: change.document.uri, diagnostics });
});

documents.listen(connection);
connection.listen();
