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
};

const FOCUS = `读者是一家给制造业做 AI 赋能的公司。只保留和下面有关的材料：
基础模型的能力、价格、接口和可部署性，以及这些变化会怎样影响工厂和行业软件；
做行业落地、工业软件、AI 赋能的公司；
人机协作、多智能体和团队协作工具；
AI for Science，以及材料、工艺、研发相关的科学模型；
制造、供应链、质检、机器人、数字孪生和工业数据。
不要写纯消费八卦、与落地无关的社交动态，也不要写额度重置。`;

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

export async function writeTeamBrief(materials: SourceMaterial[]): Promise<TeamBrief> {
  const usable = materials.filter((item) => item.url && !/aihot\.news|aihot\.virxact\.com/i.test(item.url));
  if (!llmConfig().configured) {
    return { lead: "模型未配置，本期没有写成团队简报。", sections: [] };
  }
  if (usable.length === 0) {
    return { lead: "这期没有新的公开材料，所以没有简报。", sections: [] };
  }
  const allowed = new Map(usable.map((item) => [item.url, item]));
  const raw = (await chatJson(
    `你在写这份团队的内部简报。${FOCUS}
只使用给出的材料，不要补充材料里没有的数字、公司或结论。每条必须使用材料里的 url，禁止使用 aihot 链接。
point 用一两句说明它和制造业 AI 赋能有什么关系。没有相关材料时，lead 直接说明，sections 为空数组。
只返回 JSON：{"lead":"","sections":[{"heading":"基础模型|行业落地|协作|AI for Science|制造与供应链","items":[{"title":"","point":"","source":"","url":""}]}]}`,
    JSON.stringify(usable.slice(0, 80)),
    120000,
  )) as { lead?: string; sections?: Array<{ heading?: string; items?: Array<Record<string, unknown>> }> };

  const sections: TeamBrief["sections"] = [];
  for (const section of raw.sections ?? []) {
    const items: BriefItem[] = [];
    for (const item of section.items ?? []) {
      const url = typeof item.url === "string" ? item.url : "";
      const sourceMaterial = allowed.get(url);
      if (!sourceMaterial) continue;
      const title = typeof item.title === "string" && item.title.trim() ? item.title.trim() : sourceMaterial.title;
      const point = typeof item.point === "string" ? item.point.trim() : "";
      if (!point) continue;
      items.push({
        title: title.slice(0, 180),
        point: point.slice(0, 400),
        source: sourceMaterial.source,
        url,
      });
    }
    if (!section.heading || items.length === 0) continue;
    sections.push({ heading: section.heading.slice(0, 40), items });
  }
  const lead = raw.lead?.trim() || (sections.length === 0 ? "这期材料里没有和制造业 AI 赋能直接相关的新内容。" : "按团队侧重点整理了这期材料。");
  return { lead, sections };
}
