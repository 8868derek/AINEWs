import { AsyncLocalStorage } from "node:async_hooks";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool, types, type PoolClient } from "pg";

types.setTypeParser(20, (value) => Number(value));

const storage = new AsyncLocalStorage<PoolClient>();
const locks = new Map<string, PoolClient>();
const LOCK_KEY = 742001;

let pool: Pool | null = null;

function getPool() {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL 未配置。数据库需要单独的 Postgres，例如 postgres://ainews:ainews@localhost:5432/ainews");
  }
  pool = new Pool({ connectionString, max: 10 });
  pool.on("error", (error) => {
    console.error("[ainews] 数据库连接出错", error);
  });
  return pool;
}

function toPg(sql: string) {
  let index = 0;
  return sql.replace(/\?/g, () => {
    index += 1;
    return `$${index}`;
  });
}

async function query(sql: string, params: unknown[]) {
  const text = toPg(sql);
  const client = storage.getStore();
  if (client) return client.query(text, params);
  return getPool().query(text, params);
}

export async function migrate() {
  const file = join(__dirname, "migrations", "001_init.sql");
  const sql = readFileSync(file, "utf8");
  await getPool().query(sql);
}

export async function rows<T>(sql: string, ...params: unknown[]) {
  const result = await query(sql, params);
  return result.rows as T[];
}

export async function one<T>(sql: string, ...params: unknown[]) {
  const result = await query(sql, params);
  return result.rows[0] as T | undefined;
}

export async function run(sql: string, ...params: unknown[]) {
  const result = await query(sql, params);
  return { changes: result.rowCount ?? 0 };
}

export async function insertId(sql: string, ...params: unknown[]) {
  const returning = /returning\s+id\b/i.test(sql) ? sql : `${sql} RETURNING id`;
  const result = await query(returning, params);
  const id = result.rows[0]?.id;
  if (id === undefined || id === null) throw new Error("插入后没有返回 id");
  return Number(id);
}

export async function withTransaction<T>(fn: () => Promise<T>) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const value = await storage.run(client, fn);
    await client.query("COMMIT");
    return value;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function tryLock(owner: string) {
  const client = await getPool().connect();
  try {
    const result = await client.query<{ locked: boolean }>("SELECT pg_try_advisory_lock($1) AS locked", [LOCK_KEY]);
    if (!result.rows[0]?.locked) {
      client.release();
      return false;
    }
    locks.set(owner, client);
    return true;
  } catch (error) {
    client.release();
    throw error;
  }
}

export async function unlock(owner: string) {
  const client = locks.get(owner);
  if (!client) return;
  locks.delete(owner);
  try {
    await client.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]);
  } finally {
    client.release();
  }
}

export async function stateGet(key: string) {
  return (await one<{ value: string }>("SELECT value FROM sync_state WHERE key = ?", key))?.value;
}

export async function stateSet(key: string, value: string) {
  await run(
    `INSERT INTO sync_state (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    key,
    value,
  );
}

export async function closePool() {
  if (!pool) return;
  await pool.end();
  pool = null;
}
