const { existsSync, readdirSync, readFileSync, statSync } = require("node:fs");
const { dirname, extname, join, resolve } = require("node:path");
const { fileURLToPath, pathToFileURL } = require("node:url");
const {
  CompletionItemKind,
  DocumentSymbol,
  ProposedFeatures,
  Range,
  SymbolKind,
  TextDocumentSyncKind,
  createConnection,
} = require("vscode-languageserver/node");
const { TextDocument } = require("vscode-languageserver-textdocument");
const { TextDocuments } = require("vscode-languageserver");

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

const KEYWORDS = new Set([
  "component", "render", "import", "from", "as", "fast", "true", "false", "if", "else", "each", "return", "let",
  "while",
]);

let workspaceRoots = [];
let cachedIndex = null;
let dirty = true;
const analyzedDocCache = new Map();
const diagTimers = new Map();

connection.onInitialize((params) => {
  workspaceRoots = [];
  const folders = Array.isArray(params.workspaceFolders) ? params.workspaceFolders : [];
  if (folders.length > 0) {
    for (const folder of folders) {
      const path = uriToPath(folder.uri);
      if (path) workspaceRoots.push(path);
    }
  } else if (params.rootUri) {
    const path = uriToPath(params.rootUri);
    if (path) workspaceRoots.push(path);
  }

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: { triggerCharacters: ["@", "{", ":", "(", ",", ".", "[", "/", '"', "'"] },
      hoverProvider: true,
      definitionProvider: true,
      referencesProvider: true,
      renameProvider: { prepareProvider: true },
      codeActionProvider: true,
      documentSymbolProvider: true,
      workspaceSymbolProvider: true,
      semanticTokensProvider: {
        legend: {
          tokenTypes: ["keyword", "type", "class", "function", "variable", "property"],
          tokenModifiers: [],
        },
        full: true,
      },
      signatureHelpProvider: { triggerCharacters: ["(", ","] },
    },
  };
});

documents.onDidOpen((event) => {
  dirty = true;
  scheduleDiagnostics(event.document.uri);
});

documents.onDidClose((event) => {
  dirty = true;
  clearScheduledDiagnostics(event.document.uri);
  connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] });
});

documents.onDidChangeContent((event) => {
  dirty = true;
  scheduleDiagnostics(event.document.uri);
});

connection.onCompletion((params) => {
  const idx = getIndex();
  const doc = idx.docs.get(params.textDocument.uri);
  const importCompletions = doc ? importSourceCompletions(doc.document, params.position) : null;
  if (importCompletions) {
    return importCompletions;
  }
  const prefix = doc ? getPrefix(doc.document, params.position) : "";
  const out = [
    item("component", CompletionItemKind.Keyword),
    item("render", CompletionItemKind.Keyword),
    item("import", CompletionItemKind.Keyword),
    item("as", CompletionItemKind.Keyword),
    item("@fast", CompletionItemKind.Keyword),
    snippet("component block", "component ${1:Name}(${2:props}) {\n  ~${3:state} = ${4:0}\n  render {\n    ${5:<div>{state}</div>}\n  }\n}"),
    snippet("{#if}", "{#if ${1:condition}}${2}{:else}${3}{/if}"),
    snippet("{#each}", "{#each ${1:items} as ${2:item}, ${3:i}}${4}{/each}"),
    snippet("on:click", "on:click={${1:handler}}"),
  ];
  const seen = new Set();
  for (const s of idx.symbols) {
    const key = `${s.kind}:${s.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      label: s.name,
      kind: s.kind === "component" ? CompletionItemKind.Class : s.kind === "fast" ? CompletionItemKind.Function : CompletionItemKind.Variable,
      detail: s.detail || s.kind,
      insertText: (s.kind === "component" || s.kind === "fast") ? callSnippet(s.name, s.paramNames) : s.name,
      insertTextFormat: (s.kind === "component" || s.kind === "fast") ? 2 : 1,
      documentation: s.signature ? { kind: "markdown", value: `\`${s.signature}\`` } : undefined,
    });
  }
  if (!prefix) return out;
  const lower = prefix.toLowerCase();
  return out.filter((x) => String(x.label).toLowerCase().startsWith(lower));
});

connection.onHover((params) => {
  const idx = getIndex();
  const def = resolveAt(idx, params.textDocument.uri, params.position);
  if (!def) return null;
  const lines = [`**${kindLabel(def.kind)}** \`${def.name}\``];
  if (def.signature) lines.push("", `\`${def.signature}\``);
  if (def.detail) lines.push("", def.detail);
  return { contents: { kind: "markdown", value: lines.join("\n") }, range: def.range };
});

connection.onDefinition((params) => {
  const idx = getIndex();
  const def = resolveAt(idx, params.textDocument.uri, params.position);
  return def ? { uri: def.uri, range: def.range } : null;
});

connection.onReferences((params) => {
  const idx = getIndex();
  const def = resolveAt(idx, params.textDocument.uri, params.position);
  if (!def) return [];
  const out = idx.refs.filter((r) => r.defKey === def.key).map((r) => ({ uri: r.uri, range: r.range }));
  if (params.context.includeDeclaration) out.push({ uri: def.uri, range: def.range });
  return dedupeLocations(out);
});

connection.onPrepareRename((params) => {
  const idx = getIndex();
  const w = wordAt(idx, params.textDocument.uri, params.position);
  return w ? w.range : null;
});

connection.onRenameRequest((params) => {
  const idx = getIndex();
  const def = resolveAt(idx, params.textDocument.uri, params.position);
  if (!def) return null;
  const edits = [];
  for (const ref of idx.refs) if (ref.defKey === def.key) edits.push({ uri: ref.uri, range: ref.range, newText: params.newName });
  edits.push({ uri: def.uri, range: def.range, newText: params.newName });
  const changes = {};
  for (const e of edits) {
    if (!changes[e.uri]) changes[e.uri] = [];
    changes[e.uri].push({ range: e.range, newText: e.newText });
  }
  for (const [uri, arr] of Object.entries(changes)) changes[uri] = dedupeEdits(arr);
  return { changes };
});

connection.onCodeAction((params) => {
  const idx = getIndex();
  const d = idx.docs.get(params.textDocument.uri);
  if (!d) return [];
  const actions = [];
  const diagnostics = params.context && Array.isArray(params.context.diagnostics) ? params.context.diagnostics : [];
  for (const diag of diagnostics) {
    const code = String(diag.code || "");
    if (code === "VX3021") {
      const line = d.document.getText({
        start: { line: diag.range.start.line, character: 0 },
        end: { line: diag.range.start.line, character: Number.MAX_SAFE_INTEGER },
      });
      const jsPos = line.indexOf(".js");
      if (jsPos !== -1) {
        actions.push(quickFix("Replace .js with .vx", params.textDocument.uri, {
          start: { line: diag.range.start.line, character: jsPos + 1 },
          end: { line: diag.range.start.line, character: jsPos + 3 },
        }, "vx", diag));
      }
      continue;
    }
    if (code === "VX4002") {
      const insert = findComponentClosingBracePosition(d.document, diag.range.start.line);
      if (insert) {
        actions.push(quickFix("Insert missing render block", params.textDocument.uri, insert, "\n  render { <div></div> }\n", diag));
      }
      continue;
    }
    if (code === "VX3013" || code === "VX3014" || code === "VX3015") {
      const replacement = inferUniqueNameAtRange(idx, d.document, diag.range);
      if (replacement) {
        actions.push(quickFix(`Rename to ${replacement}`, params.textDocument.uri, diag.range, replacement, diag));
      }
    }
  }
  return actions;
});

connection.onWorkspaceSymbol((params) => {
  const idx = getIndex();
  const q = (params.query || "").toLowerCase();
  const out = [];
  for (const s of idx.symbols) {
    if (s.kind === "import") continue;
    if (q && !s.name.toLowerCase().includes(q)) continue;
    out.push({
      name: s.name,
      kind: s.kind === "component" ? SymbolKind.Class : s.kind === "fast" ? SymbolKind.Function : SymbolKind.Variable,
      location: { uri: s.uri, range: s.range },
      containerName: kindLabel(s.kind),
    });
  }
  return out.slice(0, 300);
});

connection.languages.semanticTokens.on((params) => {
  const idx = getIndex();
  const d = idx.docs.get(params.textDocument.uri);
  if (!d) return { data: [] };
  const tokens = collectSemanticTokens(d);
  return { data: encodeSemanticTokens(tokens) };
});

connection.onDocumentSymbol((params) => {
  const idx = getIndex();
  const d = idx.docs.get(params.textDocument.uri);
  return d ? d.documentSymbols : [];
});

connection.onSignatureHelp((params) => {
  const idx = getIndex();
  const d = idx.docs.get(params.textDocument.uri);
  if (!d) return null;
  const end = d.document.offsetAt(params.position);
  const start = Math.max(0, end - 1800);
  const call = callContext(d.document.getText({ start: d.document.positionAt(start), end: params.position }));
  if (!call) return null;
  const sig = idx.signatures.get(call.name);
  if (!sig) return null;
  return {
    signatures: [{ label: sig.label, parameters: sig.parameters.map((p) => ({ label: p })) }],
    activeSignature: 0,
    activeParameter: Math.max(0, Math.min(call.arg, Math.max(sig.parameters.length - 1, 0))),
  };
});

documents.listen(connection);
connection.listen();

function scheduleDiagnostics(uri) {
  if (!uri) return;
  clearScheduledDiagnostics(uri);
  const timer = setTimeout(() => {
    diagTimers.delete(uri);
    publishDiagnostics(uri);
  }, 180);
  diagTimers.set(uri, timer);
}

function clearScheduledDiagnostics(uri) {
  const timer = diagTimers.get(uri);
  if (timer) {
    clearTimeout(timer);
    diagTimers.delete(uri);
  }
}

function publishDiagnostics(uri) {
  const idx = getIndex();
  const d = idx.docs.get(uri);
  if (!d) {
    connection.sendDiagnostics({ uri, diagnostics: [] });
    return;
  }
  const diagnostics = [];

  const byName = new Map();
  for (const s of d.symbols) {
    if (s.kind !== "component" && s.kind !== "fast") continue;
    if (!byName.has(s.name)) byName.set(s.name, []);
    byName.get(s.name).push(s);
  }
  for (const [name, entries] of byName) {
    const comps = entries.filter((x) => x.kind === "component");
    const fasts = entries.filter((x) => x.kind === "fast");
    if (comps.length > 1) {
      for (const c of comps) diagnostics.push(diag(c.range, "Duplicate component name in module.", "VX3013"));
    }
    if (fasts.length > 1) {
      for (const f of fasts) diagnostics.push(diag(f.range, "Duplicate @fast function name in module.", "VX3014"));
    }
    if (comps.length > 0 && fasts.length > 0) {
      for (const s of entries) diagnostics.push(diag(s.range, `Mixed declaration conflict for "${name}".`, "VX3015"));
    }
  }

  for (const c of d.components) {
    if (!c.hasRender) diagnostics.push(diag(c.range, `Component "${c.name}" is missing a render block.`, "VX4002"));
  }

  for (const impDef of d.imports) {
    const rangeToUse = impDef.importedRange || impDef.localRange || impDef.symbol.range;
    if (impDef.source.startsWith(".") && impDef.source.endsWith(".js")) {
      diagnostics.push(
        diag(
          rangeToUse,
          `Import "${impDef.source}" uses .js specifier. Use .vx or extensionless import in source files.`,
          "VX3021",
        ),
      );
      continue;
    }
    if (!impDef.source.startsWith(".")) continue;
    const targetUri = resolveImportUri(uri, impDef.source, idx.docs);
    if (!targetUri) {
      diagnostics.push(diag(rangeToUse, `Missing imported module "${impDef.source}".`, "VX2001"));
      continue;
    }
    if (impDef.kind === "named") {
      const exp = idx.exportsByUri.get(targetUri);
      if (!exp || !exp.has(impDef.imported)) {
        diagnostics.push(
          diag(
            impDef.importedRange || rangeToUse,
            `Unknown named import "${impDef.imported}" from "${impDef.source}".`,
            "VX2003",
          ),
        );
      }
    }
  }

  connection.sendDiagnostics({ uri, diagnostics: dedupeDiagnostics(diagnostics) });
}

function diag(range, message, code) {
  return {
    range,
    severity: 1,
    source: "velox-lsp",
    code,
    message: `[${code}] ${message}`,
  };
}

function dedupeDiagnostics(items) {
  const seen = new Set();
  const out = [];
  for (const x of items) {
    const k =
      `${x.code}:${x.range.start.line}:${x.range.start.character}:${x.range.end.line}:${x.range.end.character}:${x.message}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
}

function getIndex() {
  if (!dirty && cachedIndex) return cachedIndex;
  const docs = collectDocs();
  const symbols = [];
  const signatures = new Map();
  const exportsByUri = new Map();

  for (const [uri, d] of docs) {
    for (const s of d.symbols) {
      symbols.push(s);
      if (s.exported) {
        if (!exportsByUri.has(uri)) exportsByUri.set(uri, new Map());
        exportsByUri.get(uri).set(s.name, s);
      }
    }
    for (const [k, v] of d.signatures) if (!signatures.has(k)) signatures.set(k, v);
  }

  const refs = [];
  for (const [uri, d] of docs) {
    for (const t of d.tokens) {
      const resolved = resolveToken(d, t, docs, exportsByUri);
      if (resolved) refs.push({ uri, range: t.range, name: t.name, defKey: resolved.key });
    }
    for (const imp of d.imports) {
      const target = resolveImport(imp, uri, docs, exportsByUri);
      if (imp.localRange && (imp.hasAlias || !target)) {
        refs.push({ uri, range: imp.localRange, name: imp.local, defKey: imp.symbol.key });
      }
      if (imp.importedRange && target) {
        refs.push({ uri, range: imp.importedRange, name: imp.imported, defKey: target.key });
      }
    }
  }

  cachedIndex = { docs, symbols, signatures, refs, exportsByUri };
  dirty = false;
  return cachedIndex;
}

function collectDocs() {
  const out = new Map();
  for (const d of documents.all()) {
    const cached = analyzedDocCache.get(d.uri);
    if (cached && cached.kind === "open" && cached.version === d.version) {
      out.set(d.uri, cached.analysis);
      continue;
    }
    const analysis = analyze(d);
    analyzedDocCache.set(d.uri, { kind: "open", version: d.version, analysis });
    out.set(d.uri, analysis);
  }
  for (const root of workspaceRoots) {
    for (const file of vxFiles(root)) {
      const uri = pathToFileURL(file).href;
      if (out.has(uri)) continue;
      try {
        const stats = statSync(file);
        const cached = analyzedDocCache.get(uri);
        if (
          cached &&
          cached.kind === "disk" &&
          cached.mtimeMs === stats.mtimeMs &&
          cached.size === stats.size
        ) {
          out.set(uri, cached.analysis);
          continue;
        }
        const analysis = analyze(TextDocument.create(uri, "velox", 1, readFileSync(file, "utf8")));
        analyzedDocCache.set(uri, {
          kind: "disk",
          mtimeMs: stats.mtimeMs,
          size: stats.size,
          analysis,
        });
        out.set(uri, analysis);
      } catch {
        // ignore
      }
    }
  }
  return out;
}

function analyze(document) {
  const text = document.getText();
  const mask = masked(text);
  const symbols = [];
  const signatures = new Map();
  const imports = [];
  const scopes = [];
  const components = [];
  const documentSymbols = [];
  const declRanges = [];

  for (const m of mask.matchAll(/component\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:\(([^)]*)\))?\s*\{/g)) {
    const at = m.index || 0;
    const full = text.slice(at, at + (m[0] || "").length);
    const head = full.match(/component\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:\(([^)]*)\))?/);
    if (!head) continue;
    const name = head[1];
    const paramsRaw = head[2] || "";
    const open = at + (m[0] || "").lastIndexOf("{");
    const close = braceClose(mask, open);
    const bodyStart = open + 1;
    const bodyEnd = close === -1 ? bodyStart : close;
    const nameStart = findWord(text, name, at);
    if (nameStart === -1) continue;

    const compRange = range(document, nameStart, nameStart + name.length);
    const comp = sym(document.uri, "component", name, compRange, nameStart, true, paramsRaw.trim() ? `params: ${paramsRaw.trim()}` : "no params", `${name}(${paramsRaw.trim()})`, params(paramsRaw).map((p) => p.name));
    symbols.push(comp);
    declRanges.push(offsetRange(document, compRange));
    signatures.set(name, { label: `${name}(${params(paramsRaw).map((p) => `${p.name}: ${p.type}`).join(", ")})`, parameters: params(paramsRaw).map((p) => `${p.name}: ${p.type}`) });

    const dSym = DocumentSymbol.create(name, "component", SymbolKind.Class, range(document, nameStart, Math.max(nameStart + name.length, bodyEnd + 1)), compRange);
    dSym.children = dSym.children ?? [];
    const bodyText = text.slice(bodyStart, bodyEnd);
    components.push({
      name,
      range: compRange,
      hasRender: /\brender\s*\{/.test(bodyText),
    });

    const pMap = new Map();
    const sMap = new Map();
    let cursor = at + ((m[0] || "").indexOf("(") + 1);
    for (const p of params(paramsRaw)) {
      const pStart = findWord(text, p.name, cursor);
      if (pStart === -1) continue;
      cursor = pStart + p.name.length;
      const pRange = range(document, pStart, pStart + p.name.length);
      const ps = sym(document.uri, "param", p.name, pRange, pStart, false, `type: ${p.type}`, null, []);
      symbols.push(ps);
      declRanges.push(offsetRange(document, pRange));
      pMap.set(p.name, ps);
      dSym.children.push(DocumentSymbol.create(p.name, p.type, SymbolKind.Variable, pRange, pRange));
    }
    for (const st of bodyText.matchAll(/~([A-Za-z_][A-Za-z0-9_]*)\s*=/g)) {
      const n = st[1];
      const abs = bodyStart + (st.index || 0) + 1;
      const sRange = range(document, abs, abs + n.length);
      const ss = sym(document.uri, "state", n, sRange, abs, false, "reactive state", null, []);
      symbols.push(ss);
      declRanges.push(offsetRange(document, sRange));
      sMap.set(n, ss);
      dSym.children.push(DocumentSymbol.create(n, "state", SymbolKind.Field, sRange, sRange));
    }
    scopes.push({ start: bodyStart, end: bodyEnd, params: pMap, states: sMap });
    documentSymbols.push(dSym);
  }

  for (const m of mask.matchAll(/@fast\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*->\s*([A-Za-z_][A-Za-z0-9_]*)/g)) {
    const at = m.index || 0;
    const full = text.slice(at, at + (m[0] || "").length);
    const head = full.match(/@fast\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*->\s*([A-Za-z_][A-Za-z0-9_]*)/);
    if (!head) continue;
    const name = head[1];
    const pRaw = head[2] || "";
    const ret = head[3] || "i32";
    const start = findWord(text, name, at);
    if (start === -1) continue;
    const fRange = range(document, start, start + name.length);
    const sig = `${name}(${params(pRaw).map((p) => `${p.name}: ${p.type}`).join(", ")}) -> ${ret}`;
    const fs = sym(document.uri, "fast", name, fRange, start, true, `returns ${ret}`, sig, params(pRaw).map((p) => p.name));
    symbols.push(fs);
    declRanges.push(offsetRange(document, fRange));
    signatures.set(name, { label: sig, parameters: params(pRaw).map((p) => `${p.name}: ${p.type}`) });
    documentSymbols.push(DocumentSymbol.create(name, `@fast -> ${ret}`, SymbolKind.Function, fRange, fRange));
  }

  for (const imp of parseImports(text, mask, document.uri, document)) {
    imports.push(imp);
    symbols.push(imp.symbol);
    declRanges.push(offsetRange(document, imp.symbol.range));
  }

  const top = new Map();
  for (const s of symbols) if ((s.kind === "component" || s.kind === "fast") && !top.has(s.name)) top.set(s.name, s);
  const byImport = new Map();
  for (const i of imports) if (!byImport.has(i.local)) byImport.set(i.local, i);

  const tokens = [];
  for (const t of idTokens(mask, text, document)) if (!insideRanges(t.offset, declRanges)) tokens.push(t);

  return {
    uri: document.uri,
    document,
    symbols,
    signatures,
    imports,
    scopes,
    components,
    top,
    byImport,
    tokens,
    documentSymbols,
  };
}

function parseImports(text, mask, uri, document) {
  const out = [];
  for (const m of mask.matchAll(/import\s+([^;\n]+?)\s+from\s+["']([^"']+)["']\s*;?/g)) {
    const at = m.index || 0;
    const full = text.slice(at, at + (m[0] || "").length);
    const real = full.match(/import\s+([^;\n]+?)\s+from\s+["']([^"']+)["']\s*;?/);
    if (!real) continue;
    const clause = real[1].trim();
    const source = real[2];
    const clauseStart = at + full.indexOf(clause);
    const parts = splitTop(clause);
    const first = (parts[0] || "").trim();
    const second = (parts[1] || "").trim();

    if (parts.length === 2 && /^[A-Za-z_][A-Za-z0-9_]*$/.test(first)) {
      const st = findWord(text, first, clauseStart);
      if (st !== -1) out.push(imp(uri, document, first, "default", "default", source, st, st, false));
    }

    const rem = parts.length === 2 ? second : first;
    if (/^\*\s+as\s+[A-Za-z_][A-Za-z0-9_]*$/.test(rem)) {
      const alias = rem.replace(/^\*\s+as\s+/, "").trim();
      const st = findWord(text, alias, clauseStart);
      if (st !== -1) out.push(imp(uri, document, alias, "*", "namespace", source, st, st, false));
      continue;
    }
    if (rem.startsWith("{") && rem.endsWith("}")) {
      const body = rem.slice(1, -1).trim();
      if (!body) continue;
      let cursor = clauseStart;
      for (const entry of body.split(",").map((x) => x.trim()).filter(Boolean)) {
        const a = entry.split(/\s+as\s+/);
        const imported = (a[0] || "").trim();
        const local = (a[1] || a[0] || "").trim();
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(local)) continue;
        const hasAlias = local !== imported;
        const importedStart = findWord(text, imported, cursor);
        const localStart = hasAlias
          ? findWord(text, local, importedStart === -1 ? cursor : importedStart + imported.length)
          : importedStart;
        if (importedStart === -1 || localStart === -1) continue;
        cursor = Math.max(importedStart + imported.length, localStart + local.length);
        out.push(imp(uri, document, local, imported, "named", source, localStart, importedStart, hasAlias));
      }
    }
  }
  return out;
}

function resolveAt(idx, uri, pos) {
  const d = idx.docs.get(uri);
  if (!d) return null;
  const off = d.document.offsetAt(pos);
  for (const impDef of d.imports) {
    if (inRange(d.document, off, impDef.importedRange)) {
      const target = resolveImport(impDef, uri, idx.docs, idx.exportsByUri);
      if (target) {
        return target;
      }
    }
    if (!impDef.hasAlias && inRange(d.document, off, impDef.localRange)) {
      const target = resolveImport(impDef, uri, idx.docs, idx.exportsByUri);
      if (target) {
        return target;
      }
    }
  }
  for (const s of d.symbols) if (off >= s.offset && off <= s.offset + s.name.length) return s;
  for (const r of idx.refs) {
    if (r.uri !== uri) continue;
    if (inRange(d.document, off, r.range)) return idx.symbols.find((s) => s.key === r.defKey) || null;
  }
  const w = wordAt(idx, uri, pos);
  return w ? (d.top.get(w.word) || null) : null;
}

function wordAt(idx, uri, pos) {
  const d = idx.docs.get(uri);
  if (!d) return null;
  const doc = d.document;
  const text = doc.getText();
  let i = doc.offsetAt(pos);
  if (i > 0 && !/\w/.test(text[i]) && /\w/.test(text[i - 1])) i--;
  let s = i;
  let e = i;
  while (s > 0 && /\w/.test(text[s - 1])) s--;
  while (e < text.length && /\w/.test(text[e])) e++;
  if (s === e) return null;
  const word = text.slice(s, e);
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(word) ? { word, range: range(doc, s, e) } : null;
}

function resolveToken(docData, token, docs, exportsByUri) {
  const scope = docData.scopes.find((x) => token.offset >= x.start && token.offset <= x.end);
  if (scope) {
    if (scope.states.has(token.name)) return scope.states.get(token.name);
    if (scope.params.has(token.name)) return scope.params.get(token.name);
  }
  const impLocal = docData.byImport.get(token.name);
  if (impLocal) {
    const target = resolveImport(impLocal, docData.uri, docs, exportsByUri);
    if (impLocal.kind === "named" && !impLocal.hasAlias && target) {
      return target;
    }
    return impLocal.symbol;
  }
  return docData.top.get(token.name) || null;
}

function resolveImport(impDef, fromUri, docs, exportsByUri) {
  if (impDef.kind !== "named") return null;
  const targetUri = resolveImportUri(fromUri, impDef.source, docs);
  if (!targetUri) return null;
  const exp = exportsByUri.get(targetUri);
  return exp ? (exp.get(impDef.imported) || null) : null;
}

function resolveImportUri(fromUri, source, docs) {
  if (!source.startsWith(".")) return null;
  const from = uriToPath(fromUri);
  if (!from) return null;
  let target = resolve(dirname(from), source);
  if (!hasVxExtension(target)) {
    target = resolveVxFilePath(target, true);
  } else {
    target = resolveVxFilePath(target, false);
  }
  const targetUri = pathToFileURL(target).href;
  return docs.has(targetUri) ? targetUri : null;
}

function idTokens(mask, text, document) {
  const out = [];
  const re = /[A-Za-z_][A-Za-z0-9_]*/g;
  let m;
  while ((m = re.exec(mask)) !== null) {
    const name = m[0];
    const at = m.index;
    if (KEYWORDS.has(name)) continue;
    const prev = prevNonWs(text, at - 1);
    if (prev === "." || prev === "@") continue;
    out.push({ name, offset: at, range: range(document, at, at + name.length) });
  }
  return out;
}

function params(raw) {
  if (!raw || !raw.trim()) return [];
  return raw.split(",").map((x) => x.trim()).filter(Boolean).map((x) => {
    const i = x.indexOf(":");
    if (i === -1) return { name: x.trim(), type: "any" };
    return { name: x.slice(0, i).trim(), type: x.slice(i + 1).trim() || "any" };
  }).filter((x) => x.name);
}

function sym(uri, kind, name, r, offset, exported, detail, signature, paramNames) {
  const k = `${uri}:${r.start.line}:${r.start.character}:${r.end.line}:${r.end.character}:${kind}`;
  return { key: k, uri, kind, name, range: r, offset, exported, detail, signature, paramNames };
}

function imp(uri, document, local, imported, kind, source, localStart, importedStart, hasAlias) {
  const localRange = range(document, localStart, localStart + local.length);
  const importedRange = range(document, importedStart, importedStart + imported.length);
  return {
    uri,
    local,
    imported,
    kind,
    source,
    hasAlias,
    localRange,
    importedRange,
    symbol: sym(
      uri,
      "import",
      local,
      localRange,
      localStart,
      false,
      `imported from ${source}`,
      null,
      [],
    ),
  };
}

function item(label, kind) {
  return { label, kind, insertText: label };
}

function snippet(label, body) {
  return { label, kind: CompletionItemKind.Snippet, insertText: body, insertTextFormat: 2 };
}

function callSnippet(name, args) {
  if (!args || args.length === 0) return `${name}()`;
  return `${name}(${args.map((a, i) => `\${${i + 1}:${a}}`).join(", ")})`;
}

function kindLabel(kind) {
  if (kind === "component") return "Component";
  if (kind === "fast") return "@fast Function";
  if (kind === "param") return "Parameter";
  if (kind === "state") return "Reactive State";
  if (kind === "import") return "Imported Symbol";
  return "Symbol";
}

function callContext(prefix) {
  let depth = 0;
  let commas = 0;
  for (let i = prefix.length - 1; i >= 0; i--) {
    const ch = prefix[i];
    if (ch === ")") { depth++; continue; }
    if (ch === "(") {
      if (depth === 0) {
        const left = prefix.slice(0, i);
        const m = left.match(/([A-Za-z_][A-Za-z0-9_]*)\s*$/);
        return m ? { name: m[1], arg: commas } : null;
      }
      depth--;
      continue;
    }
    if (ch === "," && depth === 0) commas++;
  }
  return null;
}

function getPrefix(document, pos) {
  const text = document.getText();
  let i = document.offsetAt(pos);
  let s = i;
  while (s > 0 && /\w/.test(text[s - 1])) s--;
  return text.slice(s, i);
}

function importSourceCompletions(document, position) {
  const ctx = importSourceContext(document, position);
  if (!ctx) {
    return null;
  }
  if (!ctx.spec.startsWith(".")) {
    return [];
  }

  const fromPath = uriToPath(document.uri);
  if (!fromPath) {
    return [];
  }

  const basePath = resolve(dirname(fromPath), ctx.baseSpec || ".");
  let entries = [];
  try {
    entries = readdirSync(basePath, { withFileTypes: true });
  } catch {
    return [];
  }

  const replaceRange = {
    start: { line: position.line, character: Math.max(0, position.character - ctx.spec.length) },
    end: position,
  };

  const out = [];
  const seen = new Set();
  const lowerNeedle = ctx.spec.toLowerCase();
  const pushItem = (label, kind, detail) => {
    const normalized = label.replaceAll("\\", "/");
    if (!normalized.toLowerCase().startsWith(lowerNeedle)) {
      return;
    }
    const key = `${kind}:${normalized}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    out.push({
      label: normalized,
      kind,
      detail,
      textEdit: { range: replaceRange, newText: normalized },
      filterText: normalized,
      insertText: normalized,
    });
  };

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }
    const prefixed = `${ctx.baseSpec}${entry.name}`;
    if (entry.isDirectory()) {
      pushItem(`${prefixed}/`, CompletionItemKind.Folder, "directory");
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    if (hasVxExtension(entry.name)) {
      const baseName = entry.name.slice(0, -extname(entry.name).length);
      pushItem(`${ctx.baseSpec}${baseName}`, CompletionItemKind.File, `module (${entry.name})`);
      pushItem(prefixed, CompletionItemKind.File, `module (${entry.name})`);
      continue;
    }
    if (ctx.sideEffectOnly && hasCssExtension(entry.name)) {
      pushItem(prefixed, CompletionItemKind.File, "stylesheet");
    }
  }

  out.sort((a, b) => String(a.label).localeCompare(String(b.label)));
  return out;
}

function importSourceContext(document, position) {
  const line = document.getText({
    start: { line: position.line, character: 0 },
    end: position,
  });
  const sideEffect = line.match(/^\s*import\s+["']([^"']*)$/);
  if (sideEffect) {
    return importContext(sideEffect[1], true);
  }
  const fromClause = line.match(/^\s*import\s+.+?\s+from\s+["']([^"']*)$/);
  if (fromClause) {
    return importContext(fromClause[1], false);
  }
  return null;
}

function importContext(spec, sideEffectOnly) {
  const normalized = spec.replaceAll("\\", "/");
  const slash = normalized.lastIndexOf("/");
  const baseSpec = slash === -1 ? "" : normalized.slice(0, slash + 1);
  return { spec: normalized, sideEffectOnly, baseSpec };
}

function quickFix(title, uri, rangeOrPos, newText, diagnostic) {
  const range = normalizeRange(rangeOrPos);
  return {
    title,
    kind: "quickfix",
    diagnostics: diagnostic ? [diagnostic] : [],
    edit: {
      changes: {
        [uri]: [{ range, newText }],
      },
    },
    isPreferred: true,
  };
}

function normalizeRange(input) {
  if (input.start && input.end) {
    return input;
  }
  return { start: input, end: input };
}

function findComponentClosingBracePosition(document, lineHint) {
  const text = document.getText();
  const hintOffset = document.offsetAt({ line: Math.max(0, lineHint), character: 0 });
  const componentIdx = text.lastIndexOf("component", hintOffset);
  if (componentIdx === -1) return null;
  const open = text.indexOf("{", componentIdx);
  if (open === -1) return null;
  const close = braceClose(text, open);
  if (close === -1) return null;
  const pos = document.positionAt(close);
  return { start: pos, end: pos };
}

function inferUniqueNameAtRange(idx, document, rangeToReplace) {
  const current = document.getText(rangeToReplace).trim();
  if (!current) return null;
  const used = new Set(idx.symbols.map((s) => s.name));
  let n = 2;
  while (n < 1000) {
    const candidate = `${current}${n}`;
    if (!used.has(candidate)) return candidate;
    n++;
  }
  return null;
}

function collectSemanticTokens(docData) {
  const out = [];
  const text = docData.document.getText();
  const mask = masked(text);

  for (const m of mask.matchAll(/\b(component|render|import|from|as|@fast|if|else|each|return|let|while|true|false)\b/g)) {
    const token = m[0];
    const start = m.index || 0;
    out.push(tokenEntry(docData.document, start, token.length, semanticType("keyword")));
  }
  for (const m of mask.matchAll(/\b(i32|i64|f32|f64|str|bool|any)\b/g)) {
    const token = m[0];
    const start = m.index || 0;
    out.push(tokenEntry(docData.document, start, token.length, semanticType("type")));
  }

  for (const s of docData.symbols) {
    const t =
      s.kind === "component"
        ? "class"
        : s.kind === "fast"
          ? "function"
          : s.kind === "state" || s.kind === "param" || s.kind === "import"
            ? "variable"
            : "variable";
    out.push({
      line: s.range.start.line,
      character: s.range.start.character,
      length: s.name.length,
      tokenType: semanticType(t),
      tokenModifiers: 0,
    });
  }

  out.sort((a, b) => (a.line === b.line ? a.character - b.character : a.line - b.line));
  return dedupeSemanticTokens(out);
}

function tokenEntry(document, offset, length, tokenType) {
  const pos = document.positionAt(offset);
  return { line: pos.line, character: pos.character, length, tokenType, tokenModifiers: 0 };
}

function semanticType(name) {
  const table = {
    keyword: 0,
    type: 1,
    class: 2,
    function: 3,
    variable: 4,
    property: 5,
  };
  return table[name] ?? 4;
}

function dedupeSemanticTokens(tokens) {
  const seen = new Set();
  const out = [];
  for (const t of tokens) {
    const key = `${t.line}:${t.character}:${t.length}:${t.tokenType}:${t.tokenModifiers}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

function encodeSemanticTokens(tokens) {
  const data = [];
  let prevLine = 0;
  let prevChar = 0;
  for (const token of tokens) {
    const deltaLine = token.line - prevLine;
    const deltaStart = deltaLine === 0 ? token.character - prevChar : token.character;
    data.push(deltaLine, deltaStart, token.length, token.tokenType, token.tokenModifiers);
    prevLine = token.line;
    prevChar = token.character;
  }
  return data;
}

function masked(text) {
  const a = text.split("");
  let i = 0;
  while (i < a.length) {
    if (a[i] === "/" && a[i + 1] === "/") {
      a[i] = " "; a[i + 1] = " "; i += 2;
      while (i < a.length && a[i] !== "\n") { a[i] = " "; i++; }
      continue;
    }
    if (a[i] === '"' || a[i] === "'") {
      const q = a[i];
      a[i] = " "; i++;
      while (i < a.length) {
        if (a[i] === "\\") { a[i] = " "; if (i + 1 < a.length) a[i + 1] = " "; i += 2; continue; }
        if (a[i] === q) { a[i] = " "; i++; break; }
        a[i] = " "; i++;
      }
      continue;
    }
    i++;
  }
  return a.join("");
}

function splitTop(s) {
  const out = [];
  let cur = "";
  let d = 0;
  for (const ch of s) {
    if (ch === "{" || ch === "(" || ch === "[") d++;
    if (ch === "}" || ch === ")" || ch === "]") d--;
    if (ch === "," && d === 0) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

function braceClose(text, open) {
  if (open < 0 || open >= text.length || text[open] !== "{") return -1;
  let d = 1;
  for (let i = open + 1; i < text.length; i++) {
    if (text[i] === "{") d++;
    else if (text[i] === "}") { d--; if (d === 0) return i; }
  }
  return -1;
}

function findWord(text, word, start) {
  let i = Math.max(0, start);
  while (i < text.length) {
    const at = text.indexOf(word, i);
    if (at === -1) return -1;
    const p = at === 0 ? "" : text[at - 1];
    const n = at + word.length >= text.length ? "" : text[at + word.length];
    if (!/[A-Za-z0-9_]/.test(p) && !/[A-Za-z0-9_]/.test(n)) return at;
    i = at + word.length;
  }
  return -1;
}

function prevNonWs(text, i) {
  let x = i;
  while (x >= 0) {
    if (!/\s/.test(text[x])) return text[x];
    x--;
  }
  return "";
}

function offsetRange(document, r) {
  return { s: document.offsetAt(r.start), e: document.offsetAt(r.end) };
}

function insideRanges(offset, ranges) {
  for (const r of ranges) if (offset >= r.s && offset < r.e) return true;
  return false;
}

function inRange(document, offset, r) {
  return offset >= document.offsetAt(r.start) && offset <= document.offsetAt(r.end);
}

function range(document, s, e) {
  const max = document.getText().length;
  const start = Math.max(0, Math.min(s, max));
  const end = Math.max(start, Math.min(e, max));
  return Range.create(document.positionAt(start), document.positionAt(end));
}

function dedupeLocations(items) {
  const seen = new Set();
  const out = [];
  for (const x of items) {
    const k = `${x.uri}:${x.range.start.line}:${x.range.start.character}:${x.range.end.line}:${x.range.end.character}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
}

function dedupeEdits(items) {
  const seen = new Set();
  const out = [];
  for (const x of items) {
    const k = `${x.range.start.line}:${x.range.start.character}:${x.range.end.line}:${x.range.end.character}:${x.newText}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
}

function vxFiles(root) {
  const out = [];
  const stack = [resolve(root)];
  while (stack.length > 0) {
    const cur = stack.pop();
    for (const ent of readdirSync(cur, { withFileTypes: true })) {
      const full = join(cur, ent.name);
      if (ent.isDirectory()) {
        if (ignoreDir(ent.name)) continue;
        stack.push(full);
      } else if (ent.isFile() && hasVxExtension(full)) out.push(full);
    }
  }
  out.sort();
  return out;
}

function ignoreDir(name) {
  return name === "node_modules" || name === ".git" || name === ".velox" || name === "dist" || name.startsWith("dist-");
}

function uriToPath(uri) {
  if (!uri || !uri.startsWith("file:")) return null;
  try { return fileURLToPath(uri); } catch { return null; }
}

function hasVxExtension(filePath) {
  return extname(filePath).toLowerCase() === ".vx";
}

function hasCssExtension(filePath) {
  return extname(filePath).toLowerCase() === ".css";
}

function resolveVxFilePath(pathValue, fromExtensionless) {
  if (existsSync(pathValue)) return pathValue;
  if (hasVxExtension(pathValue)) {
    const ext = extname(pathValue);
    const base = pathValue.slice(0, -ext.length);
    const swapped = base + (ext === ".vx" ? ".VX" : ".vx");
    return existsSync(swapped) ? swapped : pathValue;
  }
  if (fromExtensionless) {
    const lower = `${pathValue}.vx`;
    if (existsSync(lower)) return lower;
    const upper = `${pathValue}.VX`;
    if (existsSync(upper)) return upper;
    return lower;
  }
  return pathValue;
}
