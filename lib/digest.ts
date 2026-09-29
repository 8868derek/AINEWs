import { contentHash, dailyLead, fetchHotTopics, fetchLatestDaily, fetchSelectedItems, type AihotItem } from "@/lib/aihot";
import { one, rows, run, stateSet, tryLock, unlock, withTransaction } from "@/lib/db";
import { buildGlossary } from "@/lib/glossary";
import { defaultCutoff, shanghaiParts, slotFor, type Slot } from "@/lib/time";

export type DigestRow = {
  id: number;
  slot: Slot;
  trigger: string;
  ran_at: string;
  cutoff_at: string;
  item_count: number;
  note: string | null;
  daily_status: string | null;
  daily_date: string | null;
  daily_lead: string | null;
  daily_url: string | null;
  glossary_note: string | null;
};

export type NewsRow = {
  id: string;
  title: string;
  original_title: string | null;
  summary: string | null;
  source_name: string;
  link_aihot: string;
  link_original: string;
  published_at: string | null;
  discovered_at: string;
  category: string | null;
  score: number | null;
  reason: string | null;
  content_hash: string;
  glossary_done: number;
  updated_at: string;
  change_kind?: string;
};

type Selected = { item: AihotItem; hash: string; change: "new" | "updated" };

function selectItems(items: AihotItem[], cutoff: Date) {
  const selected: Selected[] = [];
  for (const item of items) {
    if (!item?.id || !item.title || !item.discoveredAt) continue;
    const hash = contentHash(item);
    const existing = one<{ content_hash: string }>("SELECT content_hash FROM news_items WHERE id = ?", item.id);
    if (!existing) {
      if (new Date(item.discoveredAt).getTime() >= cutoff.getTime()) {
        selected.push({ item, hash, change: "new" });
      }
      continue;
    }
    if (existing.content_hash !== hash) selected.push({ item, hash, change: "updated" });
  }
  return selected;
}

function upsertNews(selected: Selected[], now: string) {
  for (const entry of selected) {
    const item = entry.item;
    run(
      `INSERT INTO news_items (
        id, title, original_title, summary, source_name, link_aihot, link_original,
        published_at, discovered_at, category, score, reason, content_hash, glossary_done, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        original_title = excluded.original_title,
        summary = excluded.summary,
        source_name = excluded.source_name,
        link_aihot = excluded.link_aihot,
        link_original = excluded.link_original,
        published_at = excluded.published_at,
        discovered_at = excluded.discovered_at,
        category = excluded.category,
        score = excluded.score,
        reason = excluded.reason,
        content_hash = excluded.content_hash,
        glossary_done = 0,
        updated_at = excluded.updated_at`,
      item.id,
      item.title,
      item.originalTitle,
      item.summary,
      item.source?.name || "未知来源",
      item.links?.aihot || `https://aihot.news/items/${item.id}`,
      item.links?.original || item.links?.aihot || "https://aihot.news",
      item.publishedAt,
      item.discoveredAt,
      item.category,
      item.score,
      item.reason,
      entry.hash,
      now,
    );
  }
}

async function morningDaily(slot: Slot) {
  if (slot !== "morning") {
    return { daily_status: "skipped", daily_date: null, daily_lead: null, daily_url: null };
  }
  try {
    const report = await fetchLatestDaily();
    if (!report) return { daily_status: "not_yet", daily_date: null, daily_lead: null, daily_url: null };
    const today = shanghaiParts().date;
    if (report.date !== today) {
      return { daily_status: "not_yet", daily_date: report.date, daily_lead: null, daily_url: report.links?.aihot ?? null };
    }
    return {
      daily_status: "published",
      daily_date: report.date,
      daily_lead: dailyLead(report),
      daily_url: report.links?.aihot ?? null,
    };
  } catch (error) {
    return {
      daily_status: "error",
      daily_date: null,
      daily_lead: error instanceof Error ? error.message : "日报读取失败",
      daily_url: null,
    };
  }
}

export async function runDigest(trigger: "schedule" | "manual") {
  const owner = `${trigger}-${Date.now()}`;
  if (!tryLock(owner)) {
    return { ok: false as const, error: "已有一次更新在进行" };
  }
  try {
    const now = new Date();
    const slot = slotFor(now);
    const last = one<{ ran_at: string }>("SELECT ran_at FROM digests ORDER BY id DESC LIMIT 1");
    const cutoff = last ? new Date(last.ran_at) : defaultCutoff(slot, now);
    const items = await fetchSelectedItems(cutoff);
    const selected = selectItems(items, cutoff);
    const daily = await morningDaily(slot);
    const ranAt = now.toISOString();
    const digestId = withTransaction(() => {
      upsertNews(selected, ranAt);
      const inserted = run(
        `INSERT INTO digests (
          slot, trigger, ran_at, cutoff_at, item_count, note,
          daily_status, daily_date, daily_lead, daily_url, glossary_note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        slot,
        trigger,
        ranAt,
        cutoff.toISOString(),
        selected.length,
        selected.length === 0 ? "本期无新精选" : null,
        daily.daily_status,
        daily.daily_date,
        daily.daily_lead,
        daily.daily_url,
        null,
      );
      for (const entry of selected) {
        run(
          "INSERT INTO digest_items (digest_id, news_id, change_kind) VALUES (?, ?, ?)",
          inserted.lastInsertRowid,
          entry.item.id,
          entry.change,
        );
      }
      return inserted.lastInsertRowid;
    });

    try {
      const topics = await fetchHotTopics();
      const fetchedAt = new Date().toISOString();
      withTransaction(() => {
        run("DELETE FROM hot_topics");
        for (const topic of topics) {
          if (!topic?.title || !topic.rank) continue;
          run(
            `INSERT INTO hot_topics (rank, item_id, title, source_name, link_aihot, link_original, source_count, fetched_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            topic.rank,
            topic.id ?? null,
            topic.title,
            topic.source?.name ?? null,
            topic.links?.aihot ?? null,
            topic.links?.original ?? null,
            topic.sourceCount ?? null,
            fetchedAt,
          );
        }
      });
    } catch (error) {
      console.error("[ainews] 热点榜更新失败", error);
    }

    const pending = rows<NewsRow>("SELECT * FROM news_items WHERE glossary_done = 0 ORDER BY discovered_at DESC");
    let glossaryNote = selected.length === 0 ? "没有新条目，未生成词条。" : null;
    if (pending.length > 0) {
      try {
        glossaryNote = await buildGlossary(
          pending.map((item) => ({
            id: item.id,
            title: item.title,
            summary: item.summary,
            reason: item.reason,
          })),
        );
      } catch (error) {
        glossaryNote = `词条生成失败：${error instanceof Error ? error.message : "未知错误"}`;
      }
    }
    run("UPDATE digests SET glossary_note = ? WHERE id = ?", glossaryNote, digestId);
    stateSet("last_error", "");
    stateSet("last_success_at", ranAt);
    return { ok: true as const, digestId, itemCount: selected.length, glossaryNote };
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新失败";
    stateSet("last_error", message);
    throw error;
  } finally {
    unlock(owner);
  }
}
