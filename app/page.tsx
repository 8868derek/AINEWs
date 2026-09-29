import Link from "next/link";
import { DigestView } from "@/components/DigestView";
import { digestNews, entriesForNews, latestDigest, latestDigestWithItems } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const latest = latestDigest();
  if (!latest) {
    return (
      <section className="py-8">
        <p className="text-sm text-cinnabar">还没有简报</p>
        <h1 className="mt-3 font-serif text-4xl leading-tight">今天的 AI 精选，会在这里配上中文词条。</h1>
        <p className="mt-4 max-w-xl leading-7 text-stone-700">
          点右上角「立即更新」，先拉取 AIHOT 精选。像 Gary Marcus、Jensen Huang 这样的名字，会尽量对照维基百科写成给中文读者看的说明。
        </p>
      </section>
    );
  }
  const previous = latest.item_count === 0 ? latestDigestWithItems() : undefined;
  const previousIsDifferent = previous && previous.id !== latest.id;
  const items = digestNews(latest.id);
  return (
    <div className="space-y-8">
      <DigestView digest={latest} items={items} entries={entriesForNews(items.map((item) => item.id))} />
      {previousIsDifferent ? (
        <p className="text-sm">
          <Link href={`/digests/${previous.id}`} className="text-cinnabar">
            查看上一期有内容的简报
          </Link>
        </p>
      ) : null}
    </div>
  );
}
