import { DatabaseSync } from "node:sqlite";
import { Pool } from "pg";

const tables = ["news_items", "digests", "digest_items", "glossary_entries", "news_glossary", "hot_topics", "corpus_docs", "sync_state"];

async function main() {
  const file = process.env.SQLITE_PATH || "data/app.sqlite";
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error("DATABASE_URL 未配置");
  const sqlite = new DatabaseSync(file, { readOnly: true });
  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const table of tables) {
      const exists = sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
      if (!exists) continue;
      const rows = sqlite.prepare(`SELECT * FROM ${table}`).all() as Array<Record<string, unknown>>;
      for (const row of rows) {
        const columns = Object.keys(row);
        const values = columns.map((column) => row[column]);
        const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
        await client.query(
          `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
          values,
        );
      }
    }
    await client.query("SELECT setval(pg_get_serial_sequence('digests','id'), GREATEST(COALESCE((SELECT MAX(id) FROM digests), 1), 1), true)");
    await client.query(
      "SELECT setval(pg_get_serial_sequence('glossary_entries','id'), GREATEST(COALESCE((SELECT MAX(id) FROM glossary_entries), 1), 1), true)",
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
    sqlite.close();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
