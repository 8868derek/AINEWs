import { api } from "@/lib/api";
import { safeUrl, type HotTopicRow } from "@ainews/shared";

export const dynamic = "force-dynamic";

export default async function HotPage() {
  const data = await api<{ topics: HotTopicRow[] }>("/v1/hot");
  return (
    <section>
      <h1 className="font-serif text-4xl">热点</h1>
      <p className="mt-3 text-sm text-stone-600">按独立来源聚成的当前热点。链接是原文。</p>
      {data.topics.length === 0 ? <p className="mt-8 text-stone-600">还没有热点。更新一次后会出现。</p> : null}
      <ol className="mt-8 divide-y divide-rule">
        {data.topics.map((topic) => {
          const href = safeUrl(topic.link_original);
          return (
            <li id={`hot-${topic.rank}`} key={topic.rank} className="flex scroll-mt-8 gap-4 py-4">
              <span className="w-6 font-serif text-xl text-cinnabar">{topic.rank}</span>
              <div>
                {href ? (
                  <a href={href} className="font-serif text-2xl text-ink no-underline hover:text-cinnabar">
                    {topic.title}
                  </a>
                ) : (
                  <p className="font-serif text-2xl">{topic.title}</p>
                )}
                <p className="mt-1 text-sm text-stone-500">
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
