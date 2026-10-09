import { createHash } from "crypto";
import { one, rows, run } from "@/lib/db";
import { chatJson, llmConfig } from "@/lib/llm";
import { lookupWiki, type WikiPage } from "@/lib/wiki";

export type EntityKind = "person" | "org" | "product" | "term";
export type Familiarity = "common" | "obscure";

export type GlossaryEntry = {
  id: number;
  slug: string;
  name: string;
  aliases: string;
  kind: EntityKind;
  familiarity: Familiarity;
  summary_zh: string;
  wiki_url: string | null;
  wiki_title: string | null;
  wiki_lang: string | null;
  status: string;
  updated_at: string;
};

type NewsRef = {
  id: string;
  title: string;
  summary: string | null;
  reason: string | null;
};

type Entity = {
  name: string;
  aliases: string[];
  kind: EntityKind;
  familiarity: Familiarity;
  newsIds: string[];
};

const KINDS = new Set<EntityKind>(["person", "org", "product", "term"]);
const COMMON_NAMES = new Set([
  "openai",
  "chatgpt",
  "google",
  "microsoft",
  "meta",
  "anthropic",
  "nvidia",
  "deepseek",
  "苹果",
  "谷歌",
  "微软",
  "英伟达",
]);

const FRESH_MS = 30 * 24 * 60 * 60 * 1000;

function norm(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function aliasesOf(entry: GlossaryEntry) {
  try {
    const parsed = JSON.parse(entry.aliases) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function allEntries() {
  return rows<GlossaryEntry>("SELECT * FROM glossary_entries");
}

function findEntry(name: string, aliases: string[]) {
  const keys = new Set([norm(name), ...aliases.map(norm)].filter(Boolean));
  return allEntries().find((entry) => [entry.name, ...aliasesOf(entry)].some((item) => keys.has(norm(item))));
}

function slugify(name: string) {
  const ascii = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return ascii.length >= 2 ? ascii.slice(0, 80) : `e-${createHash("sha1").update(name).digest("hex").slice(0, 10)}`;
}

function uniqueSlug(name: string) {
  const base = slugify(name);
  let slug = base;
  let n = 2;
  while (one("SELECT id FROM glossary_entries WHERE slug = ?", slug)) {
    slug = `${base}-${n}`;
    n += 1;
  }
  return slug;
}

function refineKind(kind: EntityKind, page: { title: string; description: string; extract: string } | null, summary: string): EntityKind {
  const hay = `${page?.description ?? ""} ${page?.title ?? ""} ${summary}`;
  if (/期刊|雜誌|杂志|journal/i.test(hay)) return "term";
  if (kind === "person" && /公司|企業|企业|corporation|company/i.test(hay)) return "org";
  return kind;
}

function guessKind(name: string): EntityKind {
  const key = norm(name);
  if (key === "chatgpt" || /gpt$/i.test(name)) return "product";
  if (COMMON_NAMES.has(key) || /(?:AI|Labs|Inc)$/.test(name)) return "org";
  return "person";
}

function isFresh(updatedAt: string) {
  return Date.now() - new Date(updatedAt).getTime() < FRESH_MS;
}

function clip(text: string, maxChars: number, maxSentences: number) {
  const parts = text.split(/(?<=[。！？.!?])/).map((part) => part.trim()).filter(Boolean);
  let out = "";
  for (const part of parts.slice(0, maxSentences)) {
    if ((out + part).length > maxChars && out) break;
    out += part;
  }
  const value = out.trim() || text.trim().slice(0, maxChars);
  return value;
}

function heuristicEntities(news: NewsRef[]): Entity[] {
  const found = new Map<string, Entity>();
  const pattern = /\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,}){1,2}|OpenAI|Anthropic|NVIDIA|DeepSeek|Google|Microsoft|Meta|ChatGPT)\b/g;
  const blocked = new Set([
    "agent",
    "agents",
    "analysis",
    "app",
    "arena",
    "artificial",
    "battle",
    "bot",
    "bots",
    "claude",
    "code",
    "fable",
    "flash",
    "gateway",
    "haiku",
    "intelligence",
    "lab",
    "labs",
    "managed",
    "mode",
    "model",
    "models",
    "open",
    "opus",
    "router",
    "security",
    "sonnet",
    "studio",
    "team",
    "the",
    "computer",
    "information",
    "nano",
    "omni",
  ]);
  for (const item of news) {
    pattern.lastIndex = 0;
    const matches = `${item.title}\n${item.summary ?? ""}`.match(pattern) ?? [];
    for (const match of matches) {
      const name = match.trim();
      const key = norm(name);
      if (key.length < 3) continue;
      const tokens = key.split(" ");
      if (tokens.some((token) => blocked.has(token)) && !COMMON_NAMES.has(key)) continue;
      const existing = found.get(key);
      if (existing) {
        if (!existing.newsIds.includes(item.id)) existing.newsIds.push(item.id);
        continue;
      }
      if (found.size >= 16) continue;
      found.set(key, {
        name,
        aliases: [],
        kind: guessKind(name),
        familiarity: COMMON_NAMES.has(key) ? "common" : "obscure",
        newsIds: [item.id],
      });
    }
  }
  return [...found.values()];
}

function sanitizeEntities(raw: unknown, allowedIds: Set<string>): Entity[] {
  const list = (raw as { entities?: unknown })?.entities;
  if (!Array.isArray(list)) return [];
  const entities: Entity[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name.trim() : "";
    if (!name) continue;
    const aliases = Array.isArray(record.aliases)
      ? record.aliases.filter((alias): alias is string => typeof alias === "string" && alias.trim().length > 0).map((alias) => alias.trim())
      : [];
    const kind = KINDS.has(record.kind as EntityKind) ? (record.kind as EntityKind) : "term";
    const familiarity: Familiarity = record.familiarity === "common" || COMMON_NAMES.has(norm(name)) ? "common" : "obscure";
    const newsIds = Array.isArray(record.newsIds)
      ? record.newsIds.filter((id): id is string => typeof id === "string" && allowedIds.has(id))
      : [];
    if (newsIds.length === 0) continue;
    entities.push({ name, aliases, kind, familiarity, newsIds });
    if (entities.length >= 15) break;
  }
  return entities;
}

async function extractEntities(news: NewsRef[]) {
  if (!llmConfig().configured) return heuristicEntities(news);
  const payload = news.map((item) => ({
    id: item.id,
    title: item.title,
    summary: item.summary,
    reason: item.reason,
  }));
  const raw = await chatJson(
    `你是团队内部 AI 简报的编辑。从新闻中抽出中文读者可能需要科普的人名、机构、产品、术语。
标题里出现的具体人物都要抽出。业界熟知的公司（如 OpenAI、ChatGPT、Google）标 familiarity=common；大众读者可能不认识的人物（如 Gary Marcus）标 familiarity=obscure。
name 用新闻里的原文写法。aliases 只写你有把握的中文译名或英文原名。不要编造新闻里没有的实体。最多 15 个。
只返回 JSON：{"entities":[{"name":"","aliases":[],"kind":"person|org|product|term","familiarity":"common|obscure","newsIds":["新闻id"]}]}`,
    JSON.stringify(payload),
  );
  return sanitizeEntities(raw, new Set(news.map((item) => item.id)));
}

function summaryFromWiki(entity: Entity, zh: WikiPage | null, en: WikiPage | null) {
  if (zh) {
    return {
      summary: clip(zh.extract, entity.familiarity === "common" ? 80 : 280, entity.familiarity === "common" ? 1 : 3),
      status: "verified",
      extraAliases: [] as string[],
    };
  }
  if (en) {
    return {
      summary: `已匹配英文维基条目「${en.title}」。`,
      status: "needs_model",
      extraAliases: [] as string[],
    };
  }
  return {
    summary: `本条新闻提到了${entity.name}，暂未在维基百科找到对应条目。`,
    status: "unverified",
    extraAliases: [] as string[],
  };
}

async function writeSummary(entity: Entity, zh: WikiPage | null, en: WikiPage | null, news: NewsRef[]) {
  const related = news.filter((item) => entity.newsIds.includes(item.id));
  if (!llmConfig().configured) return summaryFromWiki(entity, zh, en);

  if (!zh && !en) {
    const raw = (await chatJson(
      `只根据给出的新闻写一句中文，说明「${entity.name}」在这些新闻里指什么。不要补充百科履历、职务或生平。只返回 JSON：{"summaryZh":""}`,
      JSON.stringify(related.map((item) => ({ title: item.title, summary: item.summary }))),
    )) as { summaryZh?: string };
    return {
      summary: raw.summaryZh?.trim() || `本条新闻提到了${entity.name}，暂未在维基百科找到对应条目。`,
      status: "unverified",
      extraAliases: [] as string[],
    };
  }

  const raw = (await chatJson(
    `根据维基百科摘要，为中文读者写「${entity.name}」的说明。只使用摘要里的事实，不要添加摘要中没有的任职、言论或时间。
familiarity=${entity.familiarity}。common 时 summaryZh 只能是一句话；obscure 时写 2 到 4 句：是谁、做什么、为什么会在 AI 新闻里出现。
只返回 JSON：{"summaryZh":"","extraAliases":[]}`,
    JSON.stringify({
      name: entity.name,
      aliases: entity.aliases,
      zh: zh ? { title: zh.title, description: zh.description, extract: zh.extract } : null,
      en: en ? { title: en.title, description: en.description, extract: en.extract } : null,
    }),
  )) as { summaryZh?: string; extraAliases?: unknown };
  const extraAliases = Array.isArray(raw.extraAliases)
    ? raw.extraAliases.filter((alias): alias is string => typeof alias === "string" && alias.trim().length > 0)
    : [];
  return {
    summary: raw.summaryZh?.trim() || (zh ? clip(zh.extract, 280, 3) : `已匹配维基条目，但模型没有写成中文说明。`),
    status: "verified",
    extraAliases,
  };
}

async function contextNotes(entities: Entity[], news: NewsRef[]) {
  const notes = new Map<string, string>();
  const pairs = entities.flatMap((entity) =>
    entity.newsIds.map((newsId) => ({
      name: entity.name,
      newsId,
      title: news.find((item) => item.id === newsId)?.title ?? "",
    })),
  );
  if (llmConfig().configured && pairs.length > 0) {
    try {
      const raw = (await chatJson(
        `为每个实体和新闻写一句中文，说明这个名字在该条新闻里扮演什么角色。不要重复百科全文。只返回 JSON：{"notes":[{"name":"","newsId":"","context":""}]}`,
        JSON.stringify(pairs),
      )) as { notes?: Array<{ name?: string; newsId?: string; context?: string }> };
      for (const note of raw.notes ?? []) {
        if (!note.name || !note.newsId || !note.context?.trim()) continue;
        notes.set(`${norm(note.name)}:${note.newsId}`, note.context.trim());
      }
    } catch {
      // 关系句失败时用固定句子，词条正文仍然保留。
    }
  }
  return (name: string, newsId: string) => notes.get(`${norm(name)}:${newsId}`) || `本条新闻提到了${name}。`;
}

function saveEntry(entity: Entity, summary: string, status: string, page: WikiPage | null, extraAliases: string[]) {
  const aliases = [...new Set([...entity.aliases, ...extraAliases])];
  const now = new Date().toISOString();
  const existing = findEntry(entity.name, aliases);
  if (existing && isFresh(existing.updated_at) && existing.status === "verified") {
    return existing;
  }
  if (existing) {
    const merged = [...new Set([...aliasesOf(existing), ...aliases])];
    run(
      `UPDATE glossary_entries
       SET aliases = ?, kind = ?, familiarity = ?, summary_zh = ?, wiki_url = ?, wiki_title = ?, wiki_lang = ?, status = ?, updated_at = ?
       WHERE id = ?`,
      JSON.stringify(merged),
      entity.kind,
      entity.familiarity,
      summary,
      page?.url ?? existing.wiki_url,
      page?.title ?? existing.wiki_title,
      page?.lang ?? existing.wiki_lang,
      status,
      now,
      existing.id,
    );
    return one<GlossaryEntry>("SELECT * FROM glossary_entries WHERE id = ?", existing.id)!;
  }
  const slug = uniqueSlug(entity.name);
  const inserted = run(
    `INSERT INTO glossary_entries
      (slug, name, aliases, kind, familiarity, summary_zh, wiki_url, wiki_title, wiki_lang, status, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    slug,
    entity.name,
    JSON.stringify(aliases),
    entity.kind,
    entity.familiarity,
    summary,
    page?.url ?? null,
    page?.title ?? null,
    page?.lang ?? null,
    status,
    now,
  );
  return one<GlossaryEntry>("SELECT * FROM glossary_entries WHERE id = ?", inserted.lastInsertRowid)!;
}

async function collectEntities(news: NewsRef[]) {
  if (!llmConfig().configured) return { entities: heuristicEntities(news), modelMissed: false };
  const merged = new Map<string, Entity>();
  let modelMissed = false;
  const add = (entity: Entity) => {
    const key = norm(entity.name);
    const prev = merged.get(key);
    if (!prev) {
      merged.set(key, { ...entity, newsIds: [...entity.newsIds], aliases: [...entity.aliases] });
      return;
    }
    prev.newsIds = [...new Set([...prev.newsIds, ...entity.newsIds])];
    prev.aliases = [...new Set([...prev.aliases, ...entity.aliases])];
  };
  for (let index = 0; index < news.length; index += 6) {
    const slice = news.slice(index, index + 6);
    try {
      for (const entity of await extractEntities(slice)) add(entity);
    } catch {
      modelMissed = true;
      for (const entity of heuristicEntities(slice)) add(entity);
    }
  }
  return { entities: [...merged.values()], modelMissed };
}

export async function buildGlossary(news: NewsRef[]) {
  if (news.length === 0) return "没有新条目，未生成词条。";
  const collected = await collectEntities(news);
  let modelMissed = collected.modelMissed;
  const entities = collected.entities;
  if (entities.length === 0) {
    for (const item of news) run("UPDATE news_items SET glossary_done = 1 WHERE id = ?", item.id);
    return llmConfig().configured ? "这批新闻没有需要补充的词条。" : "模型未配置，标题里也没有可匹配的外文专名。";
  }
  const noteFor = modelMissed
    ? (name: string) => `本条新闻提到了${name}。`
    : await contextNotes(entities, news);
  let created = 0;
  for (const entity of entities) {
    const wiki = await lookupWiki(entity.name, entity.aliases).catch(() => ({ zh: null, en: null }));
    const page = wiki.zh ?? wiki.en;
    let written: { summary: string; status: string; extraAliases: string[] };
    if (modelMissed) {
      written = summaryFromWiki(entity, wiki.zh, wiki.en);
    } else {
      try {
        written = await writeSummary(entity, wiki.zh, wiki.en, news);
      } catch {
        modelMissed = true;
        written = summaryFromWiki(entity, wiki.zh, wiki.en);
      }
    }
    entity.kind = refineKind(entity.kind, page, written.summary);
    const entry = saveEntry(entity, written.summary, written.status, page, written.extraAliases);
    if (entry) created += 1;
    for (const newsId of entity.newsIds) {
      run(
        `INSERT INTO news_glossary (news_id, entry_id, context_note) VALUES (?, ?, ?)
         ON CONFLICT(news_id, entry_id) DO UPDATE SET context_note = excluded.context_note`,
        newsId,
        entry.id,
        noteFor(entity.name, newsId),
      );
    }
  }
  for (const item of news) run("UPDATE news_items SET glossary_done = 1 WHERE id = ?", item.id);
  if (modelMissed) return `补充了 ${created} 个词条。模型这次没有及时返回，已改用维基百科摘要。`;
  const mode = llmConfig().configured ? "已用模型写成中文" : "模型未配置，中文维基摘要已直接收录";
  return `补充了 ${created} 个词条（${mode}）。`;
}
