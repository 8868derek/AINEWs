import { parseBrief } from "@/lib/brief";
import { getDigest } from "@/lib/queries";
import { formatShanghai, slotLabel } from "@/lib/time";

type FeishuJson = {
  code?: number;
  msg?: string;
  tenant_access_token?: string;
  expire?: number;
  data?: {
    document?: { document_id?: string };
  };
};

type TextRun = {
  text_run: {
    content: string;
    text_element_style?: { link?: { url: string } };
  };
};

type Block = {
  block_type: number;
  text?: { elements: TextRun[]; style: Record<string, never> };
  heading1?: { elements: TextRun[]; style: Record<string, never> };
  heading2?: { elements: TextRun[]; style: Record<string, never> };
  heading3?: { elements: TextRun[]; style: Record<string, never> };
};

const HEADING: Record<number, "heading1" | "heading2" | "heading3"> = {
  3: "heading1",
  4: "heading2",
  5: "heading3",
};

let cachedToken: { value: string; expiresAt: number } | null = null;

export function feishuConfigured() {
  return Boolean(process.env.FEISHU_APP_ID?.trim() && process.env.FEISHU_APP_SECRET?.trim());
}

export async function publishDigestDoc(digestId: number): Promise<{ url: string | null; note: string | null }> {
  if (!feishuConfigured()) return { url: null, note: null };
  const digest = getDigest(digestId);
  const brief = parseBrief(digest?.brief_json);
  const title = `团队 AI 简报 · ${slotLabel(digest?.slot ?? "morning")} · ${formatShanghai(digest?.ran_at ?? new Date().toISOString())}`;
  const blocks: Block[] = [heading(3, title)];
  blocks.push(paragraph(brief?.lead || "这期没有写成简报。"));
  for (const section of brief?.sections ?? []) {
    blocks.push(heading(4, section.heading));
    for (const item of section.items) {
      blocks.push(heading(5, item.title));
      blocks.push(paragraph(item.point));
      const link = linkRun(item.source || "原文", item.url);
      if (link) blocks.push({ block_type: 2, text: { elements: [link], style: {} } });
    }
  }
  blocks.push(paragraph("材料来自 AIHOT 公开接口，简报按制造业 AI 赋能的侧重点改写。链接是原文。"));

  const documentId = await createDocument(title);
  await writeBlocks(documentId, blocks);
  const url = `https://feishu.cn/docx/${documentId}`;
  const shared = await shareWithTenant(documentId);
  return { url, note: shared };
}

function heading(blockType: 3 | 4 | 5, content: string): Block {
  const key = HEADING[blockType];
  return { block_type: blockType, [key]: { elements: [textRun(content)], style: {} } };
}

function paragraph(content: string): Block {
  return { block_type: 2, text: { elements: [textRun(content)], style: {} } };
}

function textRun(content: string): TextRun {
  return { text_run: { content: clip(content) } };
}

function linkRun(label: string, url: string | null | undefined): TextRun | null {
  if (!url || !/^https?:\/\//.test(url)) return null;
  return {
    text_run: {
      content: label,
      text_element_style: { link: { url: encodeURIComponent(url) } },
    },
  };
}

function clip(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 1800);
}

async function createDocument(title: string) {
  const folder = process.env.FEISHU_FOLDER_TOKEN?.trim();
  const data = await feishu("https://open.feishu.cn/open-apis/docx/v1/documents", {
    method: "POST",
    body: JSON.stringify({ title: clip(title).slice(0, 800), ...(folder ? { folder_token: folder } : {}) }),
  });
  const documentId = data.data?.document?.document_id;
  if (!documentId) throw new Error(data.msg || "飞书没有返回文档");
  return documentId;
}

async function writeBlocks(documentId: string, blocks: Block[]) {
  let index = 0;
  for (let start = 0; start < blocks.length; start += 40) {
    const children = blocks.slice(start, start + 40);
    await feishu(
      `https://open.feishu.cn/open-apis/docx/v1/documents/${documentId}/blocks/${documentId}/children?document_revision_id=-1`,
      {
        method: "POST",
        body: JSON.stringify({ children, index }),
      },
    );
    index += children.length;
  }
}

async function shareWithTenant(documentId: string) {
  try {
    await feishu(
      `https://open.feishu.cn/open-apis/drive/v2/permissions/${documentId}/public?type=docx`,
      {
        method: "PATCH",
        body: JSON.stringify({ link_share_entity: "tenant_readable" }),
      },
    );
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "权限设置失败";
    return `文档已创建，组织内还不能直接打开：${message}。把应用加进共享文件夹后，填写 FEISHU_FOLDER_TOKEN 再更新一次。`;
  }
}

async function feishu(url: string, init: { method: string; body: string }) {
  const token = await tenantToken();
  const response = await fetch(url, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: init.body,
    signal: AbortSignal.timeout(20000),
  });
  const data = (await response.json()) as FeishuJson;
  if (!response.ok || data.code !== 0) {
    throw new Error(data.msg || `飞书请求失败 ${response.status}`);
  }
  return data;
}

async function tenantToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const response = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app_id: process.env.FEISHU_APP_ID?.trim(),
      app_secret: process.env.FEISHU_APP_SECRET?.trim(),
    }),
    signal: AbortSignal.timeout(20000),
  });
  const data = (await response.json()) as FeishuJson;
  if (!response.ok || data.code !== 0 || !data.tenant_access_token) {
    throw new Error(data.msg || "飞书鉴权失败");
  }
  cachedToken = {
    value: data.tenant_access_token,
    expiresAt: Date.now() + (data.expire ?? 7200) * 1000,
  };
  return cachedToken.value;
}
