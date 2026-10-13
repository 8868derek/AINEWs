const WIKI_UA = "AINEWs/1.0 (https://github.com/8868derek/AINEWs; team glossary)";

export type WikiPage = {
  lang: "zh" | "en";
  title: string;
  description: string;
  extract: string;
  url: string;
};

type SearchHit = { title: string; snippet: string };

function fold(value: string) {
  return value.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function qualifier(title: string) {
  return title.match(/\(([^)]+)\)\s*$/)?.[1] ?? "";
}

function firstSentence(text: string) {
  return fold(text.split(/(?<=[。！？.!?])/)[0] ?? text);
}

function matchScore(query: string, title: string, extract: string) {
  const q = fold(query);
  if (!q) return 0;
  const note = qualifier(title);
  if (note && /football|soccer|singer|actor|album|politician|cricketer|player|wrestler/i.test(note)) return 0;
  const baseTitle = fold(title.replace(/\s*\([^)]*\)\s*$/, ""));
  if (baseTitle === q) return 100;
  const tokens = q.split(" ").filter((token) => token.length >= 3);
  if (tokens.length >= 2 && tokens.every((token) => baseTitle.split(" ").includes(token))) return 80;
  const sentence = firstSentence(extract);
  if (sentence.startsWith(q) || sentence.includes(`：${q}`) || sentence.includes(`:${q}`) || sentence.includes(`（${q}`) || sentence.includes(`(${q}`)) {
    return 60;
  }
  return 0;
}

async function wikiGet(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": WIKI_UA,
        "Api-User-Agent": WIKI_UA,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return null;
    return response;
  } catch {
    return null;
  }
}

async function searchWiki(lang: "zh" | "en", query: string): Promise<SearchHit[]> {
  const url = new URL(`https://${lang}.wikipedia.org/w/api.php`);
  url.searchParams.set("action", "query");
  url.searchParams.set("list", "search");
  url.searchParams.set("srsearch", query);
  url.searchParams.set("srlimit", "3");
  url.searchParams.set("format", "json");
  url.searchParams.set("utf8", "1");
  const response = await wikiGet(url.toString());
  if (!response) return [];
  const data = (await response.json()) as { query?: { search?: SearchHit[] } };
  return data.query?.search ?? [];
}

async function fetchSummary(lang: "zh" | "en", title: string): Promise<WikiPage | null> {
  const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const response = await wikiGet(url);
  if (!response) return null;
  const data = (await response.json()) as {
    type?: string;
    title?: string;
    description?: string;
    extract?: string;
    content_urls?: { desktop?: { page?: string } };
  };
  if (!data.title || !data.extract || data.type === "disambiguation") return null;
  return {
    lang,
    title: data.title,
    description: data.description ?? "",
    extract: data.extract,
    url: data.content_urls?.desktop?.page ?? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(data.title)}`,
  };
}

async function lookupLang(lang: "zh" | "en", queries: string[]) {
  const seen = new Set<string>();
  let best: WikiPage | null = null;
  let bestScore = 0;
  for (const query of queries) {
    const key = query.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const hits = await searchWiki(lang, query.trim());
    for (const hit of hits) {
      const page = await fetchSummary(lang, hit.title);
      if (!page) continue;
      const score = matchScore(query, page.title, page.extract);
      if (score > bestScore) {
        best = page;
        bestScore = score;
      }
      if (score >= 100) return { page, score };
    }
  }
  return best && bestScore >= 60 ? { page: best, score: bestScore } : null;
}

async function chineseTitle(englishTitle: string) {
  const url = new URL("https://en.wikipedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("prop", "langlinks");
  url.searchParams.set("lllang", "zh");
  url.searchParams.set("titles", englishTitle);
  url.searchParams.set("redirects", "1");
  url.searchParams.set("format", "json");
  url.searchParams.set("utf8", "1");
  const response = await wikiGet(url.toString());
  if (!response) return null;
  const data = (await response.json()) as {
    query?: { pages?: Record<string, { langlinks?: Array<{ "*"?: string; title?: string }> }> };
  };
  const page = Object.values(data.query?.pages ?? {})[0];
  return page?.langlinks?.[0]?.["*"] ?? page?.langlinks?.[0]?.title ?? null;
}

export async function lookupWiki(name: string, aliases: string[]) {
  const names = [name, ...aliases].map((item) => item.trim()).filter(Boolean);
  const [zhDirect, enHit] = await Promise.all([lookupLang("zh", names), lookupLang("en", names)]);
  let zh = zhDirect?.page ?? null;
  if (enHit && (!zhDirect || zhDirect.score < 80)) {
    const title = await chineseTitle(enHit.page.title);
    const linked = title ? await fetchSummary("zh", title) : null;
    if (linked) zh = linked;
  }
  return { zh, en: enHit?.page ?? null };
}
