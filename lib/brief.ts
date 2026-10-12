import { chatJson, llmConfig } from "@/lib/llm";

export type BriefItem = {
  title: string;
  point: string;
  source: string;
  url: string;
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
  industry: "行业赋能",
  paper: "AI for Science",
  "ai-models": "基础模型",
  "ai-products": "行业赋能",
  热点: "行业赋能",
  报告: "行业赋能",
};

const SECTION_ORDER = ["制造与供应链", "基础模型", "行业赋能", "协作", "AI for Science"];

const SKIP = /额度重置|codex\s*reset|重置监控/i;

type Scored = SourceMaterial & { score: number; heading: string };

export function mergeMaterials(...groups: SourceMaterial[][]) {
  const seen = new Set<string>();
  const list: SourceMaterial[] = [];
  for (const group of groups) {
    for (const item of group) {
      if (!item.url || seen.has(item.url) || SKIP.test(`${item.title} ${item.summary}`)) continue;
      seen.add(item.url);
      list.push(item);
    }
  }
  return list;
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

export function pickForBrief(materials: SourceMaterial[]) {
  const ranked = materials
    .map(scoreMaterial)
    .filter((item) => item.score >= 2)
    .sort((a, b) => b.score - a.score || String(b.at || "").localeCompare(String(a.at || "")));
  const strong = ranked.filter((item) => item.score >= 4).slice(0, 12);
  if (strong.length >= 6) return strong;
  return ranked.slice(0, 8);
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

function assemble(picks: Scored[], lead: string): TeamBrief {
  const grouped = new Map<string, BriefItem[]>();
  for (const item of picks) {
    const list = grouped.get(item.heading) ?? [];
    list.push({
      title: item.title,
      point: item.summary || "原文没有摘要。",
      source: item.source,
      url: item.url,
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
    return { lead: "近 24 小时的材料里没有对上团队侧重点。", sections: [] };
  }
  const listed = assemble(picks, `按相关度从近 24 小时挑出 ${picks.length} 条，优先制造、基础模型、协作和 AI for Science。`);
  if (!llmConfig().configured) return listed;

  try {
    const raw = (await chatJson(
      `读者是一家给制造业做 AI 赋能的公司。材料已经选定，不要增删，不要换 url。
lead 用两句说明这期最该知道的变化。
point 一句：先写材料里的事实，再写和制造落地、基础模型、协作或科研有没有关系。没有直接关系就只写事实，不要编「对工厂很重要」。
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
