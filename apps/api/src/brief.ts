import { FEED_CATEGORIES } from "./shared";
import { chatJson, llmConfig } from "./llm";

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

export type SourceMaterial = {
  title: string;
  summary: string;
  source: string;
  url: string;
  category: string;
  at?: string;
  selected?: boolean;
  hotRank?: number;
  id?: string;
};

const GROUPS: Array<{ heading: string; weight: number; pattern: RegExp }> = [
  {
    heading: "制造与供应链",
    weight: 5,
    pattern: /制造|工厂|工业|产线|质检|供应链|机器人|机械臂|数字孪生|半导体|晶圆|物流|仓储|机床|传感器|工艺|工控|汽车|新能源/,
  },
  {
    heading: "AI for Science",
    weight: 4,
    pattern: /科学|科研|论文|分子|蛋白|药物|化学|物理|生物|实验|仿真|材料/,
  },
  {
    heading: "基础模型",
    weight: 3,
    pattern: /模型|gpt|claude|gemini|llama|qwen|deepseek|mistral|开源|权重|推理|微调|部署|上下文|多模态|api|token|价格|基准|benchmark/i,
  },
  {
    heading: "协作",
    weight: 3,
    pattern: /智能体|多智能体|\bagents?\b|协作|工作流|workflow|copilot/i,
  },
  {
    heading: "行业赋能",
    weight: 3,
    pattern: /企业|落地|赋能|数字化|行业软件|b2b|saas/i,
  },
];

const CATEGORY_SCORE: Record<string, number> = {
  industry: 3,
  paper: 3,
  "ai-models": 2,
  "ai-products": 2,
  热点: 2,
  报告: 1,
};

const CATEGORY_HEADING: Record<string, string> = {
  industry: "行业热门",
  paper: "基础模型",
  "ai-models": "基础模型",
  "ai-products": "行业热门",
  热点: "行业热门",
  报告: "行业热门",
};

const SECTION_ORDER = ["制造与供应链", "基础模型", "行业热门"];

const SKIP = /额度重置|codex\s*reset|重置监控/i;

type Scored = SourceMaterial & { score: number; heading: string };

export function mergeMaterials(...groups: SourceMaterial[][]) {
  const byUrl = new Map<string, SourceMaterial>();
  for (const group of groups) {
    for (const item of group) {
      if (!item.url || SKIP.test(`${item.title} ${item.summary}`)) continue;
      const prev = byUrl.get(item.url);
      if (!prev) {
        byUrl.set(item.url, { ...item });
        continue;
      }
      if (!prev.summary && item.summary) prev.summary = item.summary;
      if (!prev.id && item.id) prev.id = item.id;
      if (item.selected) prev.selected = true;
      if (item.hotRank && (!prev.hotRank || item.hotRank < prev.hotRank)) prev.hotRank = item.hotRank;
    }
  }
  return [...byUrl.values()];
}

function scoreMaterial(item: SourceMaterial): Scored {
  const hay = `${item.title} ${item.summary}`.toLowerCase();
  let bestHeading = CATEGORY_HEADING[item.category] || "行业赋能";
  let bestWeight = 0;
  let score = CATEGORY_SCORE[item.category] ?? 0;
  for (const group of GROUPS) {
    if (!group.pattern.test(hay)) continue;
    score += group.weight;
    if (group.weight > bestWeight) {
      bestWeight = group.weight;
      bestHeading = group.heading;
    }
  }
  if (item.selected) score += 1;
  return { ...item, score, heading: bestHeading };
}

function byScore(a: Scored, b: Scored) {
  return b.score - a.score || String(b.at || "").localeCompare(String(a.at || ""));
}

export function pickForBrief(materials: SourceMaterial[]) {
  const scored = materials.map(scoreMaterial);
  const used = new Set<string>();
  const take = (items: Scored[], heading: string, limit: number) => {
    const picked: Scored[] = [];
    for (const item of items) {
      if (picked.length >= limit || used.has(item.url)) continue;
      used.add(item.url);
      picked.push({ ...item, heading });
    }
    return picked;
  };
  const manufacturingPattern = GROUPS.find((group) => group.heading === "制造与供应链")?.pattern;
  const modelPattern = GROUPS.find((group) => group.heading === "基础模型")?.pattern;
  const manufacturing = scored
    .filter((item) => (manufacturingPattern ? manufacturingPattern.test(`${item.title} ${item.summary}`) : false))
    .sort(byScore);
  const models = scored
    .filter((item) => item.category === "ai-models" || (modelPattern ? modelPattern.test(`${item.title} ${item.summary}`) : false))
    .sort(byScore);
  const hot = scored
    .filter((item) => item.hotRank)
    .sort((a, b) => (a.hotRank ?? 99) - (b.hotRank ?? 99));
  const hotFilled = [...hot];
  if (hotFilled.length < 3) {
    hotFilled.push(
      ...scored
        .filter((item) => item.category === "industry" || item.category === "热点")
        .sort(byScore),
    );
  }
  return [
    ...take(manufacturing, "制造与供应链", 4),
    ...take(models, "基础模型", 4),
    ...take(hotFilled, "行业热门", 5),
  ];
}

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

function itemPlace(item: Scored) {
  if (item.heading === "行业热门" && item.hotRank) return `/hot#hot-${item.hotRank}`;
  if (item.id) {
    const known = FEED_CATEGORIES.some((category) => category.id === item.category);
    const hash = `news-${encodeURIComponent(item.id)}`;
    return known ? `/library?category=${item.category}#${hash}` : `/library#${hash}`;
  }
  if (item.hotRank) return `/hot#hot-${item.hotRank}`;
  return "";
}

function assemble(picks: Scored[], lead: string): TeamBrief {
  const grouped = new Map<string, BriefItem[]>();
  for (const item of picks) {
    const list = grouped.get(item.heading) ?? [];
    list.push({
      title: item.title,
      point: item.summary || "原文没有摘要。",
      source: item.source,
      url: item.url,
      place: itemPlace(item),
    });
    grouped.set(item.heading, list);
  }
  const sections = SECTION_ORDER.filter((heading) => grouped.has(heading)).map((heading) => ({
    heading,
    items: grouped.get(heading) ?? [],
  }));
  return { lead, sections };
}

export async function writeTeamBrief(materials: SourceMaterial[]): Promise<TeamBrief> {
  const usable = materials.filter((item) => item.url && !/aihot\.news|aihot\.virxact\.com/i.test(item.url));
  const picks = pickForBrief(usable);
  if (picks.length === 0) {
    return { lead: "近 24 小时没有制造、基础模型或行业热门材料。", sections: [] };
  }
  const listed = assemble(picks, `这期分三块，共 ${picks.length} 条：制造与供应链、基础模型，以及行业热门前列。`);
  if (!llmConfig().configured) return listed;

  try {
    const raw = (await chatJson(
      `读者是一家给制造业做 AI 赋能的公司。材料已经选定，不要增删，不要换 url。
三块分别是制造与供应链、基础模型、行业热门。lead 用两句说明这期最该知道的变化。
point 一句，先写材料里的事实。制造和模型条目可以补一句和落地的关系；行业热门只说明它为什么被关注。不要编材料里没有的结论。
只返回 JSON：{"lead":"","points":[{"url":"","point":""}]}`,
      JSON.stringify(
        picks.map((item) => ({
          heading: item.heading,
          title: item.title,
          summary: item.summary.slice(0, 160),
          url: item.url,
        })),
      ),
      40000,
    )) as { lead?: string; points?: Array<{ url?: string; point?: string }> };

    const points = new Map<string, string>();
    for (const point of raw.points ?? []) {
      if (point.url && point.point?.trim()) points.set(point.url, point.point.trim().slice(0, 400));
    }
    const brief = assemble(picks, raw.lead?.trim() || listed.lead);
    for (const section of brief.sections) {
      for (const item of section.items) {
        const point = points.get(item.url);
        if (point) item.point = point;
      }
    }
    return brief;
  } catch {
    return listed;
  }
}
