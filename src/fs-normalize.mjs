const reactiveDeclPattern = /^(\s*)~([A-Za-z_$][\w$]*)(\s*=\s*.*)$/;
const stateDeclPattern = /^(\s*)state\s+([A-Za-z_$][\w$]*)(\s*=\s*.*)$/;
const fnDeclPattern = /^(\s*)(export\s+)?fn\s+([A-Za-z_$][\w$]*)\s*\(/;
const reactiveStartPattern = /^\s*~/;
const stateStartPattern = /^\s*state\b/;
const emptyImportClausePattern = /^\s*import\s*\{\s*\}\s*from\s*["'][^"']+["']/;
const invalidFnPattern = /^\s*(export\s+)?fn\b(?!\s+[A-Za-z_$][\w$]*\s*\()/;
const relativeJsImportPattern = /from\s+["'](\.?\.?\/[^"']+)\.(js|jsx|ts|tsx)["']/;

function nowMs() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

function toDiag(severity, line, col, code, message, fix = null) {
  return { severity, line, col, code, message, fix };
}

function normalizeFastScriptInternal(source, stats) {
  const lines = source.split(/\r?\n/);
  const out = [];

  for (const line of lines) {
    const m = line.match(reactiveDeclPattern);
    if (m) {
      stats.reactiveToLet += 1;
      out.push(`${m[1]}let ${m[2]}${m[3]}`);
      continue;
    }
    const s = line.match(stateDeclPattern);
    if (s) {
      stats.stateToLet += 1;
      out.push(`${s[1]}let ${s[2]}${s[3]}`);
      continue;
    }
    const f = line.match(fnDeclPattern);
    if (f) {
      stats.fnToFunction += 1;
      out.push(line.replace(fnDeclPattern, `${f[1]}${f[2] ?? ""}function ${f[3]}(`));
      continue;
    }
    out.push(line);
  }

  return out.join("\n");
}

export function analyzeFastScriptSource(source, { filename = "input.fs" } = {}) {
  const lines = source.split(/\r?\n/);
  const diagnostics = [];
  const declaredState = new Map();
  const isFs = /\.fs$/i.test(filename);

  for (let i = 0; i < lines.length; i += 1) {
    const lineNo = i + 1;
    const line = lines[i];

    if (!line.trim()) continue;

    const reactive = line.match(reactiveDeclPattern);
    if (reactive) {
      const name = reactive[2];
      const first = declaredState.get(name);
      if (first !== undefined) {
        diagnostics.push(
          toDiag(
            "warning",
            lineNo,
            Math.max(1, line.indexOf(name) + 1),
            "FS_DUP_STATE",
            `Duplicate reactive/state declaration "${name}" (first seen on line ${first})`,
            "Rename one declaration to avoid shadowing confusion.",
          ),
        );
      } else {
        declaredState.set(name, lineNo);
      }
      continue;
    }

    const state = line.match(stateDeclPattern);
    if (state) {
      const name = state[2];
      const first = declaredState.get(name);
      if (first !== undefined) {
        diagnostics.push(
          toDiag(
            "warning",
            lineNo,
            Math.max(1, line.indexOf(name) + 1),
            "FS_DUP_STATE",
            `Duplicate reactive/state declaration "${name}" (first seen on line ${first})`,
            "Rename one declaration to avoid shadowing confusion.",
          ),
        );
      } else {
        declaredState.set(name, lineNo);
      }
      continue;
    }

    if (reactiveStartPattern.test(line)) {
      diagnostics.push(
        toDiag(
          "warning",
          lineNo,
          Math.max(1, line.indexOf("~") + 1),
          "FS_BAD_REACTIVE",
          "Reactive declaration expected format: ~name = value",
          "Use: ~count = 0",
        ),
      );
    }

    if (stateStartPattern.test(line) && !stateDeclPattern.test(line)) {
      diagnostics.push(
        toDiag(
          "warning",
          lineNo,
          Math.max(1, line.indexOf("state") + 1),
          "FS_BAD_STATE",
          "State declaration expected format: state name = value",
          "Use: state count = 0",
        ),
      );
    }

    if (emptyImportClausePattern.test(line)) {
      diagnostics.push(
        toDiag(
          "error",
          lineNo,
          Math.max(1, line.indexOf("import") + 1),
          "FS_EMPTY_IMPORT",
          "Empty import clause is invalid.",
          'Remove import or import at least one symbol: import { x } from "./mod.fs"',
        ),
      );
    }

    if (invalidFnPattern.test(line)) {
      diagnostics.push(
        toDiag(
          "warning",
          lineNo,
          Math.max(1, line.indexOf("fn") + 1),
          "FS_BAD_FN",
          'Function shorthand expected format: fn name(args) { ... }',
          "Use: fn run(input) { ... }",
        ),
      );
    }

    if (isFs && relativeJsImportPattern.test(line)) {
      diagnostics.push(
        toDiag(
          "warning",
          lineNo,
          Math.max(1, line.indexOf("from") + 1),
          "FS_RELATIVE_JS_IMPORT",
          "Relative .js/.ts import inside .fs can hinder migration portability.",
          "Prefer extensionless imports or .fs extension for local modules.",
        ),
      );
    }
  }

  return diagnostics;
}

export function formatFastScriptDiagnostics(
  diagnostics,
  { filename = "input.fs", includeWarnings = true } = {},
) {
  const filtered = includeWarnings ? diagnostics : diagnostics.filter((d) => d.severity === "error");
  if (filtered.length === 0) return "";
  const lines = filtered.map((d) => {
    const sev = d.severity.toUpperCase();
    const fix = d.fix ? `\n  fix: ${d.fix}` : "";
    return `[${sev}] ${d.code} ${filename}:${d.line}:${d.col}\n  ${d.message}${fix}`;
  });
  return lines.join("\n");
}

export function createFastScriptDiagnosticError(
  diagnostics,
  { filename = "input.fs", includeWarnings = false } = {},
) {
  const printable = formatFastScriptDiagnostics(diagnostics, { filename, includeWarnings });
  const error = new Error(printable || `FastScript diagnostics failed for ${filename}`);
  error.code = "FASTSCRIPT_DIAGNOSTICS";
  error.diagnostics = diagnostics;
  return error;
}

export function normalizeFastScriptWithTelemetry(source, { filename = "input.fs", strict = false } = {}) {
  const startedAt = nowMs();
  const diagnostics = analyzeFastScriptSource(source, { filename });
  const errors = diagnostics.filter((d) => d.severity === "error");
  if (strict && errors.length > 0) {
    throw createFastScriptDiagnosticError(errors, { filename, includeWarnings: false });
  }

  const transformStats = {
    reactiveToLet: 0,
    stateToLet: 0,
    fnToFunction: 0,
  };
  const code = normalizeFastScriptInternal(source, transformStats);
  const durationMs = nowMs() - startedAt;

  return {
    code,
    diagnostics,
    stats: {
      lineCount: source.split(/\r?\n/).length,
      durationMs,
      ...transformStats,
    },
  };
}

export function normalizeFastScript(source) {
  return normalizeFastScriptInternal(source, {
    reactiveToLet: 0,
    stateToLet: 0,
    fnToFunction: 0,
  });
}

export function stripTypeScriptHints(source) {
  const lines = source.split(/\r?\n/);
  const out = [];
  let skippingBlock = false;
  let blockDepth = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    let next = line;

    if (skippingBlock) {
      const opens = (next.match(/{/g) || []).length;
      const closes = (next.match(/}/g) || []).length;
      blockDepth += opens - closes;
      if (blockDepth <= 0) {
        skippingBlock = false;
        blockDepth = 0;
      }
      continue;
    }

    if (/^\s*interface\s+[A-Za-z_$][\w$]*\s*[{]/.test(next) || /^\s*enum\s+[A-Za-z_$][\w$]*\s*[{]/.test(next)) {
      out.push(`// ${next.trim()} (removed by fastscript migrate)`);
      const opens = (next.match(/{/g) || []).length;
      const closes = (next.match(/}/g) || []).length;
      const depth = opens - closes;
      if (depth > 0) {
        skippingBlock = true;
        blockDepth = depth;
      }
      continue;
    }

    if (/^\s*type\s+[A-Za-z_$][\w$]*\s*=/.test(next)) {
      out.push(`// ${next.trim()} (removed by fastscript migrate)`);
      if (!next.includes(";") && next.includes("{")) {
        const opens = (next.match(/{/g) || []).length;
        const closes = (next.match(/}/g) || []).length;
        const depth = opens - closes;
        if (depth > 0) {
          skippingBlock = true;
          blockDepth = depth;
        }
      }
      continue;
    }

    next = next.replace(/\bimport\s+type\b/g, "import");
    next = next.replace(/\bexport\s+type\b/g, "export");

    next = next.replace(
      /^(\s*)(const|let|var)\s+([A-Za-z_$][\w$]*)\s*:\s*([^=;]+)([=;].*)$/,
      "$1$2 $3 $5",
    );

    if (/\bfunction\b/.test(next) || /\)\s*=>/.test(next)) {
      next = next.replace(/\(([^)]*)\)/, (_, params) => {
        const cleaned = params.replace(
          /([A-Za-z_$][\w$]*)\s*:\s*([A-Za-z_$][\w$<>\[\]\|& ?. ]*)/g,
          "$1",
        );
        return `(${cleaned})`;
      });
      next = next.replace(/\)\s*:\s*([A-Za-z_$][\w$<>\[\]\|& ?. ]*)\s*\{/g, ") {");
      next = next.replace(/\bfunction\s+([A-Za-z_$][\w$]*)\s*<[^>]+>\s*\(/g, "function $1(");
    }

    next = next.replace(/^\s*<([A-Za-z_$][\w$,\s]*)>\s*\(/, "(");
    next = next.replace(/\)\s*=>\s*<[A-Za-z_$][\w$<>\[\]\|&, ?.]*>/g, ") =>");
    next = next.replace(/\sas\s+const\b/g, "");
    next = next.replace(/\s+satisfies\s+[A-Za-z_$][\w$<>\[\]\|&, ?.]*/g, "");
    out.push(next);
  }

  return out.join("\n");
}
