import { NewsFeed } from "@/components/NewsFeed";
import { WaitingRefresh } from "@/components/WaitingRefresh";
import { FEED_CATEGORIES, entriesForNews, latestDigest, listHotTopics, listStoredNews, storedNewsCount } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const params = await searchParams;
  const category = FEED_CATEGORIES.some((item) => item.id === params.category) ? params.category || "" : "";
  const total = storedNewsCount();
  if (total === 0) {
    return (
      <section className="py-8">
        <p className="text-sm text-cinnabar">资料库还是空的</p>
        <h1 className="mt-3 font-serif text-4xl leading-tight">精选会先写入本地，再按日期和主题打开。</h1>
        <WaitingRefresh />
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
