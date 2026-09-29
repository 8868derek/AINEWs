import { runDigest } from "@/lib/digest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  try {
    const result = await runDigest("manual");
    if (!result.ok) {
      return Response.json(result, { status: 409 });
    }
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新失败";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
