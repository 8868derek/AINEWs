import { NewsFeed } from "@/components/NewsFeed";
import { api, asEntryMap } from "@/lib/api";
import { categoryLabel, FEED_CATEGORIES, type EntryLink, type NewsRow } from "@ainews/shared";

export const dynamic = "force-dynamic";

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ category?: string; mode?: string }> }) {
  const params = await searchParams;
  const category = FEED_CATEGORIES.some((item) => item.id === params.category) ? params.category || "" : "";
  const selectedOnly = params.mode === "selected" && !category;
  const query = new URLSearchParams();
  if (category) query.set("category", category);
  if (selectedOnly) query.set("mode", "selected");
  const data = await api<{ items: NewsRow[]; entries: Record<string, EntryLink[]>; newsCount: number }>(
    `/v1/library${query.size ? `?${query}` : ""}`,
  );
  if (data.newsCount === 0) {
    return (
      <section className="py-8">
        <h1 className="font-serif text-4xl">动态还是空的</h1>
        <p className="mt-3 text-stone-600">下一次更新会把近 7 天的公开条目写进数据库。</p>
      </section>
    );
  }
  const title = category ? categoryLabel(category) : selectedOnly ? "精选" : "全部动态";
  const note = category
    ? "这个分类来自 AIHOT 的公开条目。点标题打开原文。"
    : selectedOnly
      ? "只看 AIHOT 标成精选的条目。"
      : "近 7 天公开条目，不限于精选。";
  return <NewsFeed title={title} note={note} items={data.items} entries={asEntryMap(data.entries)} />;
}
