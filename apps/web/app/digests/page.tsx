import Link from "next/link";
import { api } from "@/lib/api";
import { formatShanghai, safeUrl, slotLabel, type DigestRow } from "@ainews/shared";

export const dynamic = "force-dynamic";

export default async function DigestsPage() {
  const data = await api<{ digests: DigestRow[] }>("/v1/digests");
  return (
    <section>
      <h1 className="font-serif text-4xl">往期</h1>
      {data.digests.length === 0 ? <p className="mt-6 text-stone-600">还没有简报。</p> : null}
      <ul className="mt-6 divide-y divide-rule">
        {data.digests.map((digest) => (
          <li key={digest.id} className="py-4">
            <Link href={`/digests/${digest.id}`} className="no-underline">
              <span className="text-sm text-cinnabar">{slotLabel(digest.slot)}</span>
              <span className="mt-1 block font-serif text-2xl text-ink">{formatShanghai(digest.ran_at)}</span>
            </Link>
            <p className="mt-1 text-sm text-stone-600">
              {digest.item_count > 0 ? `${digest.item_count} 条` : digest.note || "这期没有条目"}
              {safeUrl(digest.feishu_url) ? (
                <>
                  {" · "}
                  <a href={safeUrl(digest.feishu_url) ?? undefined}>飞书文档</a>
                </>
              ) : null}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
