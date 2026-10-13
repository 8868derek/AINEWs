import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = await api<{ ok?: boolean; accepted?: boolean; error?: string }>("/v1/digests/run", { method: "POST" });
    return Response.json(result, { status: result.ok === false ? 409 : 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新失败";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
