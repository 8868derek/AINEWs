import Link from "next/link";
import { listDigests } from "@/lib/queries";
import { formatShanghai, slotLabel } from "@/lib/time";

export const dynamic = "force-dynamic";

export default function DigestsPage() {
  const digests = listDigests();
  return (
    <section>
      <h1 className="font-serif text-4xl">往期</h1>
      {digests.length === 0 ? <p className="mt-6 text-stone-600">还没有简报。</p> : null}
      <ul className="mt-6 divide-y divide-rule">
        {digests.map((digest) => (
          <li key={digest.id} className="py-4">
            <Link href={`/digests/${digest.id}`} className="no-underline">
              <span className="text-sm text-cinnabar">{slotLabel(digest.slot)}</span>
              <span className="mt-1 block font-serif text-2xl text-ink">{formatShanghai(digest.ran_at)}</span>
            </Link>
            <p className="mt-1 text-sm text-stone-600">{digest.item_count > 0 ? `${digest.item_count} 条精选` : digest.note}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
