import fs from "fs";
import path from "path";
import { DatabaseSync, type SQLInputValue, type StatementSync } from "node:sqlite";

const globalForDb = globalThis as unknown as { ainewsDb?: DatabaseSync };

function databasePath() {
  return process.env.DATABASE_PATH || path.join(process.cwd(), "data", "app.sqlite");
}

function migrate(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS digests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slot TEXT NOT NULL,
      trigger TEXT NOT NULL,
      ran_at TEXT NOT NULL,
      cutoff_at TEXT NOT NULL,
      item_count INTEGER NOT NULL,
      note TEXT,
      daily_status TEXT,
      daily_date TEXT,
      daily_lead TEXT,
      daily_url TEXT,
      glossary_note TEXT
    );

    CREATE TABLE IF NOT EXISTS news_items (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      original_title TEXT,
      summary TEXT,
      source_name TEXT NOT NULL,
      link_aihot TEXT NOT NULL,
      link_original TEXT NOT NULL,
      published_at TEXT,
      discovered_at TEXT NOT NULL,
      category TEXT,
      score INTEGER,
      reason TEXT,
      content_hash TEXT NOT NULL,
      glossary_done INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS digest_items (
      digest_id INTEGER NOT NULL,
      news_id TEXT NOT NULL,
      change_kind TEXT NOT NULL,
      PRIMARY KEY (digest_id, news_id),
      FOREIGN KEY (digest_id) REFERENCES digests(id),
      FOREIGN KEY (news_id) REFERENCES news_items(id)
    );

    CREATE TABLE IF NOT EXISTS glossary_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      aliases TEXT NOT NULL,
      kind TEXT NOT NULL,
      familiarity TEXT NOT NULL,
      summary_zh TEXT NOT NULL,
      wiki_url TEXT,
      wiki_title TEXT,
      wiki_lang TEXT,
      status TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS news_glossary (
      news_id TEXT NOT NULL,
      entry_id INTEGER NOT NULL,
      context_note TEXT NOT NULL,
      PRIMARY KEY (news_id, entry_id),
      FOREIGN KEY (news_id) REFERENCES news_items(id),
      FOREIGN KEY (entry_id) REFERENCES glossary_entries(id)
    );

    CREATE TABLE IF NOT EXISTS sync_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS job_lock (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      locked_until TEXT NOT NULL,
      owner TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS hot_topics (
      rank INTEGER PRIMARY KEY,
      item_id TEXT,
      title TEXT NOT NULL,
      source_name TEXT,
      link_aihot TEXT,
      link_original TEXT,
      source_count INTEGER,
      fetched_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_news_glossary_entry ON news_glossary(entry_id);
    CREATE INDEX IF NOT EXISTS idx_digest_ran ON digests(ran_at);
    CREATE INDEX IF NOT EXISTS idx_news_discovered ON news_items(discovered_at);
  `);
  ensureColumn(db, "digests", "feishu_url", "TEXT");
  ensureColumn(db, "digests", "feishu_note", "TEXT");
}

function ensureColumn(db: DatabaseSync, table: string, column: string, definition: string) {
  const info = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!info.some((item) => item.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function getDb() {
  if (!globalForDb.ainewsDb) {
    const file = databasePath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const db = new DatabaseSync(file);
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA foreign_keys = ON;");
    globalForDb.ainewsDb = db;
  }
  migrate(globalForDb.ainewsDb);
  return globalForDb.ainewsDb;
}

function stmt(sql: string): StatementSync {
  return getDb().prepare(sql);
}

export function rows<T>(sql: string, ...params: SQLInputValue[]): T[] {
  return stmt(sql).all(...params) as T[];
}

export function one<T>(sql: string, ...params: SQLInputValue[]): T | undefined {
  return stmt(sql).get(...params) as T | undefined;
}

export function run(sql: string, ...params: SQLInputValue[]) {
  const result = stmt(sql).run(...params);
  return {
    changes: Number(result.changes),
    lastInsertRowid: Number(result.lastInsertRowid),
  };
}

export function withTransaction<T>(fn: () => T): T {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const value = fn();
    db.exec("COMMIT");
    return value;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function tryLock(owner: string, ttlMs = 10 * 60 * 1000) {
  const until = new Date(Date.now() + ttlMs).toISOString();
  const now = new Date().toISOString();
  return withTransaction(() => {
    const current = one<{ locked_until: string }>("SELECT locked_until FROM job_lock WHERE id = 1");
    if (current && current.locked_until > now) return false;
    run(
      `INSERT INTO job_lock (id, locked_until, owner) VALUES (1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET locked_until = excluded.locked_until, owner = excluded.owner`,
      until,
      owner,
    );
    return true;
  });
}

export function unlock(owner: string) {
  run("UPDATE job_lock SET locked_until = ? WHERE id = 1 AND owner = ?", new Date(0).toISOString(), owner);
}

export function stateGet(key: string) {
  return one<{ value: string }>("SELECT value FROM sync_state WHERE key = ?", key)?.value;
}

export function stateSet(key: string, value: string) {
  run(
    `INSERT INTO sync_state (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    key,
    value,
  );
}
