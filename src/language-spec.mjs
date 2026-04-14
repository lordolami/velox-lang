import {
  analyzeFastScriptSource,
  createFastScriptDiagnosticError,
  formatFastScriptDiagnostics,
  normalizeFastScriptWithTelemetry,
} from "./fs-normalize.mjs";

export const FASTSCRIPT_LANGUAGE_SPEC_VERSION = "v1.0";

export const FASTSCRIPT_LANGUAGE_SPEC = Object.freeze({
  version: FASTSCRIPT_LANGUAGE_SPEC_VERSION,
  goals: [
    "Lenient syntax that compiles to JavaScript quickly",
    "JS ecosystem compatibility first",
    ".fs primary surface with .js zero-friction support",
  ],
  sugar: [
    "~name = value  -> let name = value",
    "state name = value -> let name = value",
    "fn add(a, b) -> function add(a, b)",
  ],
  diagnostics: {
    errors: ["FS_EMPTY_IMPORT"],
    warnings: [
      "FS_BAD_REACTIVE",
      "FS_BAD_STATE",
      "FS_BAD_FN",
      "FS_DUP_STATE",
      "FS_RELATIVE_JS_IMPORT",
    ],
  },
});

export function getLanguageSpec() {
  return FASTSCRIPT_LANGUAGE_SPEC;
}

export function inspectFastScriptSource(source, { filename = "input.fs" } = {}) {
  const diagnostics = analyzeFastScriptSource(source, { filename });
  const printable = formatFastScriptDiagnostics(diagnostics, { filename, includeWarnings: true });
  return {
    ok: diagnostics.every((diag) => diag.severity !== "error"),
    diagnostics,
    printable,
  };
}

export function compileFastScriptSource(source, { filename = "input.fs", strict = false } = {}) {
  return normalizeFastScriptWithTelemetry(source, { filename, strict });
}

export function assertFastScriptSource(source, { filename = "input.fs" } = {}) {
  const diagnostics = analyzeFastScriptSource(source, { filename });
  const errors = diagnostics.filter((diag) => diag.severity === "error");
  if (errors.length > 0) throw createFastScriptDiagnosticError(errors, { filename, includeWarnings: false });
  return diagnostics;
}

