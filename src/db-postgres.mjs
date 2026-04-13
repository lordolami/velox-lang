export async function createPostgresAdapter({ connectionString = process.env.DATABASE_URL } = {}) {
  const { Client } = await import("pg");
  const client = new Client({ connectionString });
  await client.connect();

  return {
    async query(sql, params = []) {
      const res = await client.query(sql, params);
      return res.rows;
    },
    async transaction(fn) {
      await client.query("BEGIN");
      try {
        const out = await fn({ query: (sql, params = []) => client.query(sql, params).then((r) => r.rows) });
        await client.query("COMMIT");
        return out;
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      }
    },
    async migrate(lockId = 4839201, migrations = []) {
      await client.query("SELECT pg_advisory_lock($1)", [lockId]);
      try {
        await client.query("CREATE TABLE IF NOT EXISTS fs_migrations (id text primary key, applied_at timestamptz not null default now())");
        const done = new Set((await client.query("SELECT id FROM fs_migrations")).rows.map((r) => r.id));
        for (const m of migrations) {
          if (done.has(m.id)) continue;
          await m.up({ query: (sql, params = []) => client.query(sql, params).then((r) => r.rows) });
          await client.query("INSERT INTO fs_migrations(id) VALUES($1)", [m.id]);
        }
      } finally {
        await client.query("SELECT pg_advisory_unlock($1)", [lockId]);
      }
    },
    async close() {
      await client.end();
    },
  };
}
