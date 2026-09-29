import Link from "next/link";
import type { NewsRow } from "@/lib/digest";
import type { EntryLink, HotTopicRow } from "@/lib/queries";
import { categoryLabel, FEED_CATEGORIES, kindLabel, safeUrl, statusLabel } from "@/lib/queries";
import { clockTime, dayHeading, shanghaiDateKey } from "@/lib/time";

export function NewsFeed({
  category,
  topics,
  items,
  entries,
  daily,
}: {
  category: string;
  topics: HotTopicRow[];
  items: NewsRow[];
  entries: Map<string, EntryLink[]>;
  daily: { status: string | null; date: string | null; lead: string | null; url: string | null } | null;
}) {
  const groups = groupByDay(items);
  return (
    <div className="space-y-10">
      <header>
        <p className="text-sm text-cinnabar">已保存的精选</p>
        <h1 className="mt-2 font-serif text-4xl">今天的 AI 新闻</h1>
        <p className="mt-3 text-sm text-stone-600">按北京时间归档。8:00 和 14:00 自动写入，打开就能看。</p>
      </header>
      <CategoryBar category={category} />
      {daily ? <DailyBanner daily={daily} /> : null}
      {topics.length > 0 && category === "" ? <HotList topics={topics} /> : null}
      {groups.length === 0 ? <p className="py-8 text-stone-600">这个分类下还没有保存的新闻。</p> : null}
      {groups.map((group) => (
        <section key={group.date}>
          <h2 className="border-b border-rule pb-2 font-serif text-2xl">{group.label}</h2>
          <p className="mt-2 text-sm text-stone-500">{group.items.length} 条</p>
          <div className="mt-2 divide-y divide-rule">
            {group.items.map((item) => (
              <FeedItem key={item.id} item={item} entries={entries.get(item.id) ?? []} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function CategoryBar({ category }: { category: string }) {
  return (
    <nav className="flex flex-wrap gap-2 text-sm">
      {FEED_CATEGORIES.map((item) => {
        const active = item.id === category;
        const href = item.id ? `/?category=${item.id}` : "/";
        return (
          <Link
            key={item.id || "all"}
            href={href}
            className={`rounded-full px-3 py-1 no-underline ${active ? "bg-ink text-white" : "bg-white text-stone-700"}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function HotList({ topics }: { topics: HotTopicRow[] }) {
  return (
    <section>
      <h2 className="font-serif text-2xl">当前热点</h2>
      <ol className="mt-4 divide-y divide-rule rounded-2xl bg-white/70">
        {topics.map((topic) => {
          const href = safeUrl(topic.link_aihot) || safeUrl(topic.link_original);
          return (
            <li key={topic.rank} className="flex gap-3 px-4 py-3">
              <span className="w-6 font-serif text-lg text-cinnabar">{topic.rank}</span>
              <div>
                {href ? (
                  <a href={href} className="font-medium text-ink no-underline hover:text-cinnabar">
                    {topic.title}
                  </a>
                ) : (
                  <p className="font-medium">{topic.title}</p>
                )}
                <p className="mt-1 text-xs text-stone-500">
                  {topic.source_name || "多源"}
                  {topic.source_count ? ` · ${topic.source_count} 家信源` : ""}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function DailyBanner({
  daily,
}: {
  daily: { status: string | null; date: string | null; lead: string | null; url: string | null };
}) {
  if (daily.status === "not_yet") {
    return (
      <section className="rounded-2xl border border-rule bg-white/60 p-4">
        <h2 className="font-medium">日报尚未发布</h2>
        <p className="mt-1 text-sm text-stone-600">AIHOT 日报在北京时间 08:00 更新。{daily.date ? `目前最新一期是 ${daily.date}。` : ""}</p>
      </section>
    );
  }
  if (daily.status !== "published") return null;
  const href = safeUrl(daily.url);
  return (
    <section className="rounded-2xl border border-rule bg-white/70 p-4">
      <h2 className="font-medium">今日日报</h2>
      {daily.lead ? <p className="mt-2 leading-7 text-stone-700">{daily.lead}</p> : null}
      {href ? (
        <a href={href} className="mt-3 inline-block text-sm text-cinnabar">
          在 AIHOT 阅读 {daily.date}
        </a>
      ) : null}
    </section>
  );
}

function FeedItem({ item, entries }: { item: NewsRow; entries: EntryLink[] }) {
  const aihot = safeUrl(item.link_aihot);
  const original = safeUrl(item.link_original);
  return (
    <article className="grid grid-cols-[3.5rem_1fr] gap-3 py-6 sm:grid-cols-[4.5rem_1fr]">
      <time className="pt-1 text-sm text-stone-500">{clockTime(item.discovered_at)}</time>
      <div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
          <span className="rounded-full bg-white px-2 py-1">{categoryLabel(item.category)}</span>
          <span>{item.source_name}</span>
        </div>
        <h3 className="mt-2 font-serif text-2xl leading-snug">
          {aihot ? (
            <a href={aihot} className="text-ink no-underline hover:text-cinnabar">
              {item.title}
            </a>
          ) : (
            item.title
          )}
        </h3>
        {item.summary ? <p className="mt-3 leading-7 text-stone-700">{item.summary}</p> : null}
        {item.reason ? <p className="mt-3 text-sm leading-6 text-moss">推荐理由：{item.reason}</p> : null}
        <div className="mt-3 flex gap-4 text-sm">
          {aihot ? (
            <a href={aihot} className="text-cinnabar">
              站内阅读
            </a>
          ) : null}
          {original ? (
            <a href={original} className="text-cinnabar">
              原文
            </a>
          ) : null}
        </div>
        {entries.length > 0 ? (
          <details className="mt-4 rounded-2xl bg-white/70 p-4">
            <summary className="cursor-pointer font-medium">补充词条 · {entries.length}</summary>
            <ul className="mt-4 space-y-4">
              {entries.map((entry) => {
                const wiki = safeUrl(entry.wiki_url);
                return (
                  <li key={entry.id}>
                    <div className="flex flex-wrap items-baseline gap-2">
                      <Link href={`/glossary/${entry.slug}`} className="font-serif text-lg text-ink no-underline hover:text-cinnabar">
                        {entry.name}
                      </Link>
                      <span className="text-xs text-stone-500">{kindLabel(entry.kind)}</span>
                      {entry.status !== "verified" ? <span className="text-xs text-cinnabar">{statusLabel(entry.status)}</span> : null}
                    </div>
                    <p className="mt-2 leading-7 text-stone-700">{entry.summary_zh}</p>
                    <p className="mt-1 text-sm text-stone-500">{entry.context_note}</p>
                    {wiki ? (
                      <a href={wiki} className="mt-1 inline-block text-sm text-cinnabar">
                        维基百科
                      </a>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </details>
        ) : null}
      </div>
    </article>
  );
}

function groupByDay(items: NewsRow[]) {
  const groups: Array<{ date: string; label: string; items: NewsRow[] }> = [];
  for (const item of items) {
    const date = shanghaiDateKey(item.discovered_at);
    const current = groups[groups.length - 1];
    if (!current || current.date !== date) {
      groups.push({ date, label: dayHeading(date), items: [item] });
    } else {
      current.items.push(item);
    }
  }
  return groups;
}
