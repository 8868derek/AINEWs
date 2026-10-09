import { NewsFeed } from "@/components/NewsFeed";
import { FEED_CATEGORIES, entriesForNews, latestDigest, listHotTopics, listStoredNews, storedNewsCount } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const params = await searchParams;
  const category = FEED_CATEGORIES.some((item) => item.id === params.category) ? params.category || "" : "";
  const total = storedNewsCount();
  if (total === 0) {
    return (
      <section className="py-8">
        <h1 className="font-serif text-4xl">素材还是空的</h1>
        <p className="mt-3 text-stone-600">下一次更新会把 AIHOT 的公开材料写进本地。</p>
      </section>
    );
  }
  const items = listStoredNews(category);
  const latest = latestDigest();
  const daily =
    latest && latest.slot === "morning"
      ? { status: latest.daily_status, date: latest.daily_date, lead: latest.daily_lead, url: latest.daily_url }
      : null;
  return (
    <NewsFeed
      category={category}
      topics={listHotTopics()}
      items={items}
      entries={entriesForNews(items.map((item) => item.id))}
      daily={daily}
    />
  );
}
