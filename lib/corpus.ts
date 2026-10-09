import {
  contentHash,
  fetchCodexRecent,
  fetchHotTopics,
  fetchItems,
  fetchLatestDaily,
  fetchLatestMonthly,
  fetchLatestWeekly,
  fetchStory,
  storyPublicId,
  type AihotItem,
} from "@/lib/aihot";
import { one, run } from "@/lib/db";
import type { SourceMaterial } from "@/lib/brief";

function saveDoc(kind: string, docKey: string, title: string, payload: unknown) {
  run(
    `INSERT INTO corpus_docs (kind, doc_key, title, payload, fetched_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(kind, doc_key) DO UPDATE SET
       title = excluded.title,
       payload = excluded.payload,
       fetched_at = excluded.fetched_at`,
    kind,
    docKey,
    title,
    JSON.stringify(payload),
    new Date().toISOString(),
  );
}

function rememberItem(item: AihotItem, now: string) {
  if (!item?.id || !item.title) return;
  const hash = contentHash(item);
  const existing = one<{ content_hash: string; glossary_done: number }>("SELECT content_hash, glossary_done FROM news_items WHERE id = ?", item.id);
  const selected = item.selected ? 1 : 0;
  const glossaryDone = selected && (!existing || existing.content_hash !== hash) ? 0 : (existing?.glossary_done ?? 1);
  run(
    `INSERT INTO news_items (
      id, title, original_title, summary, source_name, link_aihot, link_original,
      published_at, discovered_at, category, score, reason, content_hash, glossary_done, updated_at, selected
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      glossary_done = ?,
      updated_at = excluded.updated_at,
      selected = excluded.selected`,
    item.id,
    item.title,
    item.originalTitle,
    item.summary,
    item.source?.name || "未知来源",
    item.links?.aihot || `https://aihot.news/items/${item.id}`,
    item.links?.original || "",
    item.publishedAt,
    item.discoveredAt,
    item.category,
    item.score,
    item.reason,
    hash,
    glossaryDone,
    now,
    selected,
    glossaryDone,
  );
}

function material(title: string, summary: string | null | undefined, source: string, url: string | null | undefined, category: string): SourceMaterial | null {
  if (!title || !url || !/^https?:\/\//.test(url) || /aihot\.news|aihot\.virxact\.com/i.test(url)) return null;
  return {
    title: title.slice(0, 180),
    summary: (summary || "").replace(/\s+/g, " ").trim().slice(0, 280),
    source: source || "未知来源",
    url,
    category,
  };
}

function addMaterial(list: SourceMaterial[], seen: Set<string>, item: SourceMaterial | null) {
  if (!item || seen.has(item.url)) return;
  seen.add(item.url);
  list.push(item);
}

type ReportItem = {
  title?: string;
  summary?: string | null;
  source?: { name?: string };
  links?: { original?: string };
  publishedAt?: string;
};

function reportItems(report: Record<string, unknown> | null, cutoff: number, seen: Set<string>, list: SourceMaterial[]) {
  const sections = Array.isArray(report?.sections) ? report.sections : [];
  for (const section of sections) {
    const items = Array.isArray((section as { items?: ReportItem[] }).items) ? (section as { items: ReportItem[] }).items : [];
    for (const item of items) {
      const published = item.publishedAt ? new Date(item.publishedAt).getTime() : cutoff;
      if (published < cutoff) continue;
      addMaterial(list, seen, material(item.title || "", item.summary, item.source?.name || "", item.links?.original, "报告"));
    }
  }
}

export async function syncCorpus(cutoff: Date) {
  const now = new Date().toISOString();
  const materials: SourceMaterial[] = [];
  const seen = new Set<string>();
  const cutoffMs = cutoff.getTime();

  const items = await fetchItems("all", "7d");
  for (const item of items) {
    rememberItem(item, now);
    const discovered = item.discoveredAt ? new Date(item.discoveredAt).getTime() : 0;
    if (discovered < cutoffMs) continue;
    addMaterial(
      materials,
      seen,
      material(item.title, item.summary, item.source?.name || "", item.links?.original, item.category || "动态"),
    );
  }
  if (materials.length > 60) materials.length = 60;

  try {
    const daily = await fetchLatestDaily();
    if (daily) saveDoc("daily", daily.date || "latest", daily.date || "日报", daily);
  } catch (error) {
    console.error("[ainews] 日报归档失败", error);
  }

  try {
    const weekly = await fetchLatestWeekly();
    if (weekly) {
      saveDoc("weekly", String(weekly.week || "latest"), String(weekly.headline || weekly.week || "周报"), weekly);
      reportItems(weekly, cutoffMs, seen, materials);
    }
  } catch (error) {
    console.error("[ainews] 周报归档失败", error);
  }

  try {
    const monthly = await fetchLatestMonthly();
    if (monthly) {
      saveDoc("monthly", String(monthly.month || "latest"), String(monthly.headline || monthly.month || "月报"), monthly);
      reportItems(monthly, cutoffMs, seen, materials);
    }
  } catch (error) {
    console.error("[ainews] 月报归档失败", error);
  }

  try {
    const codex = await fetchCodexRecent();
    saveDoc("codex", String(codex.today || "recent"), "Codex 额度重置", codex);
  } catch (error) {
    console.error("[ainews] Codex 归档失败", error);
  }

  try {
    const topics = await fetchHotTopics();
    for (const topic of topics) {
      addMaterial(materials, seen, material(topic.title, "", topic.source?.name || "", topic.links?.original, "热点"));
      const publicId = storyPublicId(topic.links?.story);
      if (!publicId) continue;
      try {
        const story = await fetchStory(publicId);
        if (!story) continue;
        saveDoc("story", publicId, String(story.title || topic.title), story);
        const reports = Array.isArray(story.reports) ? (story.reports as ReportItem[]).slice(0, 4) : [];
        for (const report of reports) {
          addMaterial(materials, seen, material(report.title || "", report.summary, report.source?.name || "", report.links?.original, "热点"));
        }
      } catch (error) {
        console.error("[ainews] 事件归档失败", publicId, error);
      }
    }
  } catch (error) {
    console.error("[ainews] 热点事件归档失败", error);
  }

  return materials.slice(0, 80);
}
