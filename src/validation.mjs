export async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString("utf8");
  return text;
}

export async function readJsonBody(req) {
  const raw = await readBody(req);
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error("Invalid JSON body");
    error.status = 400;
    throw error;
  }
}

export function validateShape(schema, input, scope = "input") {
  if (!schema || typeof schema !== "object") return { ok: true, value: input ?? {} };
  const errors = [];
  const out = {};
  const source = input && typeof input === "object" ? input : {};

  for (const [key, rule] of Object.entries(schema)) {
    const value = source[key];
    const optional = typeof rule === "string" && rule.endsWith("?");
    const t = typeof rule === "string" ? rule.replace(/\?$/, "") : String(rule);

    if (value === undefined || value === null) {
      if (!optional) errors.push(`${scope}.${key} is required`);
      continue;
    }

    if (t === "array") {
      if (!Array.isArray(value)) errors.push(`${scope}.${key} must be array`);
      else out[key] = value;
      continue;
    }

    if (t === "int") {
      const n = Number(value);
      if (!Number.isInteger(n)) errors.push(`${scope}.${key} must be integer`);
      else out[key] = n;
      continue;
    }

    if (t === "float" || t === "number") {
      const n = Number(value);
      if (!Number.isFinite(n)) errors.push(`${scope}.${key} must be number`);
      else out[key] = n;
      continue;
    }

    if (t === "bool" || t === "boolean") {
      if (typeof value !== "boolean") errors.push(`${scope}.${key} must be boolean`);
      else out[key] = value;
      continue;
    }

    if (t === "str" || t === "string") {
      if (typeof value !== "string") errors.push(`${scope}.${key} must be string`);
      else out[key] = value;
      continue;
    }

    out[key] = value;
  }

  if (errors.length) {
    const error = new Error(`Validation failed: ${errors.join("; ")}`);
    error.status = 400;
    error.details = errors;
    throw error;
  }
  return { ok: true, value: out };
}

