import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createFileDatabase } from "./db.mjs";

const MIGRATIONS_DIR = resolve("app/db/migrations");
const SEED_FILE = resolve("app/db/seed.js");

async function importFresh(path) {
  return import(`${pathToFileURL(path).href}?t=${Date.now()}`);
}

export async function runDbMigrate() {
  const db = createFileDatabase({ dir: ".fastscript", name: "appdb" });
  if (!existsSync(MIGRATIONS_DIR)) {
    console.log("db migrate: no app/db/migrations directory");
    return;
  }
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => /\.(js|mjs|cjs)$/.test(f)).sort();
  let count = 0;
  for (const file of files) {
    const mod = await importFresh(join(MIGRATIONS_DIR, file));
    const fn = mod.up ?? mod.default;
    if (typeof fn === "function") {
      await fn(db);
      count += 1;
      console.log(`db migrate: applied ${file}`);
    }
  }
  console.log(`db migrate complete: ${count} migration(s)`);
}

export async function runDbSeed() {
  const db = createFileDatabase({ dir: ".fastscript", name: "appdb" });
  if (!existsSync(SEED_FILE)) {
    console.log("db seed: no app/db/seed.js file");
    return;
  }
  const mod = await importFresh(SEED_FILE);
  const fn = mod.seed ?? mod.default;
  if (typeof fn !== "function") throw new Error("app/db/seed.js must export seed(db) or default(db)");
  await fn(db);
  console.log("db seed complete");
}

