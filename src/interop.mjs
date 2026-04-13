export async function importAny(specifier) {
  const mod = await import(specifier);
  if (mod?.default && Object.keys(mod).length === 1) return mod.default;
  return mod;
}

export function resolveExport(mod, names = ["default"]) {
  for (const n of names) if (mod && mod[n] !== undefined) return mod[n];
  return undefined;
}

export function interopCall(mod, fn, ...args) {
  const target = mod?.[fn] || (typeof mod === "function" ? mod : null);
  if (typeof target !== "function") throw new Error(`Interop function not found: ${fn}`);
  return target(...args);
}
