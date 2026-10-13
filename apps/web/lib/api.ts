import type { EntryLink } from "@ainews/shared";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const base = process.env.API_URL?.trim().replace(/\/$/, "");
  if (!base) throw new Error("API_URL 未配置。前端只通过后端读取数据。");
  const token = process.env.API_TOKEN?.trim();
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok && response.status !== 202) {
    throw new Error(data.error || "请求失败");
  }
  return data as T;
}

export function asEntryMap(entries: Record<string, EntryLink[]>) {
  return new Map(Object.entries(entries));
}
