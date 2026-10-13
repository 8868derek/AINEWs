import { api } from "@/lib/api";
import type { RuntimeStatus } from "@ainews/shared";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await api<RuntimeStatus>("/v1/status"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "状态读取失败";
    return Response.json({ error: message }, { status: 500 });
  }
}
