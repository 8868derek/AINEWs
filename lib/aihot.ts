import { createHash, randomUUID } from "crypto";
import { stateGet, stateSet } from "@/lib/db";

export type AihotItem = {
  id: string;
  title: string;
  originalTitle: string | null;
  summary: string | null;
  source: { name: string };
  links: { aihot: string; original: string };
  publishedAt: string | null;
  discoveredAt: string;
  category: string | null;
  score: number | null;
  selected: boolean;
  reason: string | null;
};

type ItemsResponse = {
  items: AihotItem[];
  page: { count: number; hasMore: boolean; nextCursor: string | null };
};

export type DailyReport = {
  date: string;
  lead: string | { title?: string | null; leadParagraph?: string | null } | null;
  links: { aihot: string };
  sections: Array<{
    label: string;
    items: Array<{ title: string; summary: string | null }>;
  }>;
};

const BASE = "https://aihot.news";

function actorId() {
  const existing = stateGet("actor_id");
  if (existing) return existing;
  const id = process.env.AIHOT_ACTOR_ID?.trim() || randomUUID();
  stateSet("actor_id", id);
  return id;
}

function userAgent() {
  return `aihot-api/1.0 aihot-actor/${actorId()}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function aihotFetch(url: string) {
  let lastError = "AIHOT 请求失败";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": userAgent(),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("retry-after") || "5");
      await sleep(Math.min(Number.isFinite(retryAfter) ? retryAfter : 5, 30) * 1000);
      lastError = "AIHOT 限流";
      continue;
    }
    if (response.status >= 500 || response.status === 566 || response.status === 567) {
      const requestId = response.headers.get("x-request-id");
      lastError = `AIHOT ${response.status}${requestId ? `（${requestId}）` : ""}`;
      await sleep(400 * 2 ** attempt);
      continue;
    }
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`AIHOT ${response.status}：${body.slice(0, 180)}`);
    }
    return response;
  }
  throw new Error(lastError);
}

export async function fetchSelectedItems(cutoff: Date) {
  const window = Date.now() - cutoff.getTime() > 24 * 60 * 60 * 1000 ? "7d" : "24h";
  const items: AihotItem[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 8; page += 1) {
    const url = new URL("/api/v1/items", BASE);
    url.searchParams.set("mode", "selected");
    url.searchParams.set("window", window);
    url.searchParams.set("limit", "100");
    if (cursor) url.searchParams.set("cursor", cursor);
    const response = await aihotFetch(url.toString());
    const data = (await response.json()) as ItemsResponse;
    items.push(...(data.items ?? []));
    if (!data.page?.hasMore || !data.page.nextCursor) break;
    cursor = data.page.nextCursor;
  }
  return items;
}

export type HotTopic = {
  rank: number;
  id: string;
  title: string;
  source?: { name?: string };
  links?: { aihot?: string; original?: string };
  sourceCount?: number;
};

export async function fetchHotTopics() {
  const response = await aihotFetch(new URL("/api/v1/hot-topics", BASE).toString());
  const data = (await response.json()) as { items?: HotTopic[] };
  return data.items ?? [];
}

export async function fetchLatestDaily() {
  const response = await aihotFetch(new URL("/api/v1/dailies/latest", BASE).toString());
  const data = (await response.json()) as { report?: DailyReport };
  return data.report ?? null;
}

export function contentHash(item: AihotItem) {
  return createHash("sha256")
    .update([item.title, item.originalTitle ?? "", item.summary ?? "", item.reason ?? ""].join("\n"))
    .digest("hex");
}

export function dailyLead(report: DailyReport) {
  const lead = report.lead;
  if (typeof lead === "string" && lead.trim()) return lead.trim();
  if (lead && typeof lead === "object") {
    const paragraph = typeof lead.leadParagraph === "string" ? lead.leadParagraph.trim() : "";
    const title = typeof lead.title === "string" ? lead.title.trim() : "";
    if (paragraph) return paragraph;
    if (title) return title;
  }
  const titles: string[] = [];
  for (const section of report.sections ?? []) {
    for (const item of section.items ?? []) {
      if (!item.title) continue;
      titles.push(item.title);
      if (titles.length >= 3) return titles.join("；");
    }
  }
  return titles.join("；");
}
