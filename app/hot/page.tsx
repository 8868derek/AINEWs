import { listHotTopics, safeUrl } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default function HotPage() {
  const topics = listHotTopics();
  return (
    <section>
      <h1 className="font-serif text-4xl">热点</h1>
      <p className="mt-3 text-sm text-stone-600">按独立来源聚成的当前热点。链接是原文。</p>
      {topics.length === 0 ? <p className="mt-8 text-stone-600">还没有热点。更新一次后会出现。</p> : null}
      <ol className="mt-8 divide-y divide-rule">
        {topics.map((topic) => {
          const href = safeUrl(topic.link_original);
          return (
            <li key={topic.rank} className="flex gap-4 py-4">
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
