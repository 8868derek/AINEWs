export function llmConfig() {
  const baseUrl = process.env.LLM_BASE_URL?.trim() ?? "";
  const apiKey = process.env.LLM_API_KEY?.trim() ?? "";
  const model = process.env.LLM_MODEL?.trim() ?? "";
  let host = "";
  try {
    if (baseUrl) host = new URL(baseUrl).host;
  } catch {
    host = "";
  }
  return {
    configured: Boolean(baseUrl && apiKey && model),
    baseUrl,
    apiKey,
    model,
    host,
  };
}

export function parseModelJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced?.[1] ?? text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < start) {
    throw new Error("模型没有返回 JSON");
  }
  return JSON.parse(raw.slice(start, end + 1));
}

function chatEndpoint(baseUrl: string) {
  const trimmed = baseUrl.replace(/\/$/, "");
  if (trimmed.endsWith("/chat/completions")) return trimmed;
  return `${trimmed}/chat/completions`;
}

export async function chatJson(system: string, user: string) {
  const { configured, baseUrl, apiKey, model } = llmConfig();
  if (!configured) throw new Error("模型未配置");
  const response = await fetch(chatEndpoint(baseUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`模型请求失败 ${response.status}：${body.slice(0, 240)}`);
  }
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  return parseModelJson(content);
}
