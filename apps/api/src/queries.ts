import { one, rows, stateGet } from "./db";
import type { DigestRow, NewsRow } from "./digest";
import type { GlossaryEntry } from "./glossary";
import { llmConfig } from "./llm";
import { nextRun } from "./shared";

export type EntryLink = GlossaryEntry & { context_note: string; news_id: string };

import { FEED_CATEGORIES, categoryLabel } from "./shared";

export { FEED_CATEGORIES, categoryLabel };

export function kindLabel(kind: string) {
  if (kind === "person") return "人物";
  if (kind === "org") return "机构";
  if (kind === "product") return "产品";
  if (kind === "term") return "术语";
  return kind;
}

export function statusLabel(status: string) {
  if (status === "verified") return "已核对维基";
  if (status === "needs_model") return "待生成中文";
  return "待核实";
}

export function safeUrl(url: string | null | undefined) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") return url;
  } catch {
    return null;
  }
  return null;
}

export async function listDigests() {
  return await rows<DigestRow>("SELECT * FROM digests ORDER BY id DESC");
}

export async function getDigest(id: number) {
  return (await rows<DigestRow>("SELECT * FROM digests WHERE id = ?", id))[0];
}

export async function latestDigest() {
  return (await rows<DigestRow>("SELECT * FROM digests ORDER BY id DESC LIMIT 1"))[0];
}

export async function latestDigestWithItems() {
  return (await rows<DigestRow>("SELECT * FROM digests WHERE item_count > 0 ORDER BY id DESC LIMIT 1"))[0];
}

export type HotTopicRow = {
  rank: number;
  item_id: string | null;
  title: string;
  source_name: string | null;
  link_aihot: string | null;
  link_original: string | null;
  source_count: number | null;
  fetched_at: string;
};

export async function listStoredNews(category: string, selectedOnly = false) {
  return await rows<NewsRow>(
    `SELECT * FROM news_items
     WHERE (? = '' OR category = ?)
       AND (? = 0 OR selected = 1)
     ORDER BY discovered_at DESC
     LIMIT 300`,
    category,
    category,
    selectedOnly ? 1 : 0,
  );
}

export async function listHotTopics() {
  return await rows<HotTopicRow>("SELECT * FROM hot_topics ORDER BY rank ASC");
}

export async function storedNewsCount() {
  return (await rows<{ n: number }>("SELECT COUNT(*) AS n FROM news_items"))[0]?.n ?? 0;
}

export async function latestCorpusDoc(kind: string) {
  return await one<{ title: string | null; payload: string; fetched_at: string }>(
    "SELECT title, payload, fetched_at FROM corpus_docs WHERE kind = ? ORDER BY fetched_at DESC LIMIT 1",
    kind,
  );
}

export async function digestNews(digestId: number) {
  return await rows<NewsRow>(
    `SELECT n.*, di.change_kind
     FROM digest_items di
     JOIN news_items n ON n.id = di.news_id
     WHERE di.digest_id = ?
     ORDER BY n.discovered_at DESC`,
    digestId,
  );
}

export async function entriesForNews(newsIds: string[]) {
  if (newsIds.length === 0) return new Map<string, EntryLink[]>();
  const placeholders = newsIds.map(() => "?").join(", ");
  const links = await rows<EntryLink>(
    `SELECT g.*, ng.context_note, ng.news_id
     FROM news_glossary ng
     JOIN glossary_entries g ON g.id = ng.entry_id
     WHERE ng.news_id IN (${placeholders})
     ORDER BY g.name`,
    ...newsIds,
  );
  const grouped = new Map<string, EntryLink[]>();
  for (const link of links) {
    const list = grouped.get(link.news_id) ?? [];
    list.push(link);
    grouped.set(link.news_id, list);
  }
  return grouped;
}

export async function listGlossary(kind: string, query: string) {
  const q = query.trim();
  const like = `%${q}%`;
  return await rows<GlossaryEntry>(
    `SELECT * FROM glossary_entries
     WHERE (? = '' OR kind = ?)
       AND (? = '' OR name LIKE ? OR aliases LIKE ? OR summary_zh LIKE ?)
     ORDER BY updated_at DESC`,
    kind,
    kind,
    q,
    like,
    like,
    like,
  );
}

export async function getGlossary(slug: string) {
  return (await rows<GlossaryEntry>("SELECT * FROM glossary_entries WHERE slug = ?", slug))[0];
}

export async function newsForEntry(entryId: number) {
  return await rows<NewsRow & { context_note: string }>(
    `SELECT n.*, ng.context_note
     FROM news_glossary ng
     JOIN news_items n ON n.id = ng.news_id
     WHERE ng.entry_id = ?
     ORDER BY n.discovered_at DESC`,
    entryId,
  );
}

export async function runtimeStatus() {
  const llm = llmConfig();
  const upcoming = nextRun();
  return {
    llmConfigured: llm.configured,
    llmModel: llm.model,
    llmHost: llm.host,
    lastSuccessAt: await stateGet("last_success_at") || null,
    lastError: await stateGet("last_error") || null,
    nextSlot: upcoming.slot,
    nextAt: upcoming.at.toISOString(),
    digestCount: (await rows<{ n: number }>("SELECT COUNT(*) AS n FROM digests"))[0]?.n ?? 0,
    entryCount: (await rows<{ n: number }>("SELECT COUNT(*) AS n FROM glossary_entries"))[0]?.n ?? 0,
    feishuConfigured: Boolean(process.env.FEISHU_APP_ID?.trim() && process.env.FEISHU_APP_SECRET?.trim()),
    feishuUrl: (await rows<{ feishu_url: string | null }>("SELECT feishu_url FROM digests WHERE feishu_url IS NOT NULL ORDER BY id DESC LIMIT 1"))[0]?.feishu_url ?? null,
    feishuNote: (await rows<{ feishu_note: string | null }>("SELECT feishu_note FROM digests WHERE feishu_note IS NOT NULL ORDER BY id DESC LIMIT 1"))[0]?.feishu_note ?? null,
  };
}
