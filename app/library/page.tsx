import { NewsFeed } from "@/components/NewsFeed";
import { categoryLabel, entriesForNews, FEED_CATEGORIES, listStoredNews, storedNewsCount } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ category?: string; mode?: string }> }) {
  const params = await searchParams;
  const category = FEED_CATEGORIES.some((item) => item.id === params.category) ? params.category || "" : "";
  const selectedOnly = params.mode === "selected" && !category;
  if (storedNewsCount() === 0) {
    return (
      <section className="py-8">
        <h1 className="font-serif text-4xl">动态还是空的</h1>
        <p className="mt-3 text-stone-600">下一次更新会把近 7 天的公开条目写进本地。</p>
      </section>
    );
  }
  const items = listStoredNews(category, selectedOnly);
  const title = category ? categoryLabel(category) : selectedOnly ? "精选" : "全部动态";
  const note = category
    ? "这个分类来自 AIHOT 的公开条目。点标题打开原文。"
    : selectedOnly
      ? "只看 AIHOT 标成精选的条目。"
      : "近 7 天公开条目，不限于精选。";
  return <NewsFeed title={title} note={note} items={items} entries={entriesForNews(items.map((item) => item.id))} />;
}
