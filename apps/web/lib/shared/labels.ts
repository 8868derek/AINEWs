export type Slot = "morning" | "afternoon";

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
  feishu_url?: string | null;
  feishu_note?: string | null;
  brief_json?: string | null;
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
  selected?: number;
};

export type GlossaryEntry = {
  id: number;
  slug: string;
  name: string;
  aliases: string;
  kind: "person" | "org" | "product" | "term";
  familiarity: "common" | "obscure";
  summary_zh: string;
  wiki_url: string | null;
  wiki_title: string | null;
  wiki_lang: string | null;
  status: string;
  updated_at: string;
};

export type EntryLink = GlossaryEntry & { context_note: string; news_id: string };

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

export type BriefItem = {
  title: string;
  point: string;
  source: string;
  url: string;
  place?: string;
};

export type TeamBrief = {
  lead: string;
  sections: Array<{ heading: string; items: BriefItem[] }>;
};

export type RuntimeStatus = {
  llmConfigured: boolean;
  llmModel: string;
  llmHost: string;
  lastSuccessAt: string | null;
  lastError: string | null;
  nextSlot: Slot;
  nextAt: string;
  digestCount: number;
  entryCount: number;
  feishuConfigured: boolean;
  feishuUrl: string | null;
  feishuNote: string | null;
};

export function parseBrief(raw: string | null | undefined): TeamBrief | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as TeamBrief;
    if (!data || typeof data.lead !== "string" || !Array.isArray(data.sections)) return null;
    return data;
  } catch {
    return null;
  }
}

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
