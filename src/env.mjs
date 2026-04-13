import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

function parseDotEnv(raw) {
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    out[key] = val;
  }
  return out;
}

export function loadEnv({ root = process.cwd(), mode = process.env.NODE_ENV || "development" } = {}) {
  const files = [".env", `.env.${mode}`, mode === "production" ? ".env.local" : null].filter(Boolean);
  const merged = {};
  for (const file of files) {
    const path = join(root, file);
    if (!existsSync(path)) continue;
    Object.assign(merged, parseDotEnv(readFileSync(path, "utf8")));
  }
  for (const [k, v] of Object.entries(merged)) if (process.env[k] === undefined) process.env[k] = v;
  return { mode, values: merged };
}

export function validateEnv(schema = {}, env = process.env) {
  const errors = [];
  const out = {};
  for (const [key, ruleRaw] of Object.entries(schema || {})) {
    const rule = typeof ruleRaw === "string" ? { type: ruleRaw } : { ...(ruleRaw || {}) };
    const type = String(rule.type || "string").replace(/\?$/, "");
    const optional = String(rule.type || "").endsWith("?") || rule.optional === true;
    const value = env[key];
    if (value === undefined || value === "") {
      if (!optional) errors.push(`${key} is required`);
      continue;
    }
    if (type === "int") {
      const n = Number(value);
      if (!Number.isInteger(n)) errors.push(`${key} must be int`); else out[key] = n;
      continue;
    }
    if (type === "float" || type === "number") {
      const n = Number(value);
      if (!Number.isFinite(n)) errors.push(`${key} must be number`); else out[key] = n;
      continue;
    }
    if (type === "bool" || type === "boolean") {
      if (!["true", "false", true, false].includes(value)) errors.push(`${key} must be boolean`);
      else out[key] = value === true || value === "true";
      continue;
    }
    out[key] = String(value);
  }
  if (errors.length) {
    const error = new Error(`Env validation failed: ${errors.join("; ")}`);
    error.status = 500;
    error.details = errors;
    throw error;
  }
  return out;
}

export async function validateAppEnv({ root = process.cwd() } = {}) {
  const schemaPath = join(root, "app", "env.schema.js");
  if (!existsSync(schemaPath)) return null;
  const mod = await import(`${pathToFileURL(schemaPath).href}?t=${Date.now()}`);
  const schema = mod.schema || mod.default || {};
  return validateEnv(schema, process.env);
}

export function ensureEnvExample() {
  const example = join(process.cwd(), ".env.example");
  if (existsSync(example)) return;
  writeFileSync(example, "# FastScript env template\nSESSION_SECRET=change_me\n", "utf8");
}

export function appendEnvIfMissing(key, value) {
  const path = join(process.cwd(), ".env");
  const current = existsSync(path) ? readFileSync(path, "utf8") : "";
  if (current.includes(`${key}=`)) return;
  appendFileSync(path, `${key}=${value}\n`, "utf8");
}
