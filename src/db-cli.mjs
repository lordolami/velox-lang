import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { createFileDatabase } from "./db.mjs";
import { importSourceModule } from "./module-loader.mjs";

const MIGRATIONS_DIR = resolve("app/db/migrations");
const SEED_FILES = [resolve("app/db/seed.fs"), resolve("app/db/seed.js"), resolve("app/db/seed.mjs"), resolve("app/db/seed.cjs")];

export async function runDbMigrate() {
  const db = createFileDatabase({ dir: ".fastscript", name: "appdb" });
  if (!existsSync(MIGRATIONS_DIR)) {
    console.log("db migrate: no app/db/migrations directory");
    return;
  }
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => /\.(fs|js|mjs|cjs)$/.test(f)).sort();
  let count = 0;
  for (const file of files) {
    const mod = await importSourceModule(join(MIGRATIONS_DIR, file), { platform: "node" });
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
  const seedFile = SEED_FILES.find((p) => existsSync(p));
  if (!seedFile) {
    console.log("db seed: no app/db/seed file");
    return;
  }
  const mod = await importSourceModule(seedFile, { platform: "node" });
  const fn = mod.seed ?? mod.default;
  if (typeof fn !== "function") throw new Error("app/db/seed must export seed(db) or default(db)");
  await fn(db);
  console.log("db seed complete");
}
