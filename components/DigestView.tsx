import Link from "next/link";
import { TeamBriefView } from "@/components/TeamBrief";
import { parseBrief } from "@/lib/brief";
import type { DigestRow, NewsRow } from "@/lib/digest";
import type { EntryLink } from "@/lib/queries";
import { categoryLabel, kindLabel, safeUrl, statusLabel } from "@/lib/queries";
import { formatShanghai, slotLabel } from "@/lib/time";

export function DigestView({
  digest,
  items,
  entries,
}: {
  digest: DigestRow;
  items: NewsRow[];
  entries: Map<string, EntryLink[]>;
}) {
  return (
    <article>
      <header className="border-b border-rule pb-6">
        <p className="text-sm text-cinnabar">{slotLabel(digest.slot)}</p>
        <h1 className="mt-2 font-serif text-4xl">{formatShanghai(digest.ran_at)}</h1>
        <p className="mt-3 text-sm text-stone-600">
          {digest.item_count > 0 ? `${digest.item_count} 条精选` : digest.note}
          {digest.glossary_note ? ` · ${digest.glossary_note}` : ""}
          {safeUrl(digest.feishu_url) ? (
            <>
              {" · "}
              <a href={safeUrl(digest.feishu_url) ?? undefined}>飞书文档</a>
            </>
          ) : null}
          {digest.feishu_note ? ` · ${digest.feishu_note}` : ""}
        </p>
      </header>
      {parseBrief(digest.brief_json) ? (
        <div className="border-b border-rule py-8">
          <TeamBriefView brief={parseBrief(digest.brief_json)!} />
        </div>
      ) : null}
      <DailyBanner digest={digest} />
      {items.length === 0 ? (
        <p className="py-10 text-lg text-stone-600">这一期没有新的精选。上一期可以在往期里查看。</p>
      ) : (
        <div className="divide-y divide-rule">
          {items.map((item) => (
            <NewsCard key={item.id} item={item} entries={entries.get(item.id) ?? []} />
          ))}
        </div>
      )}
    </article>
  );
}

function DailyBanner({ digest }: { digest: DigestRow }) {
  if (digest.slot !== "morning" || !digest.daily_status || digest.daily_status === "skipped") return null;
  if (digest.daily_status === "not_yet") {
    return (
      <section className="mt-6 rounded-2xl border border-rule bg-white/60 p-4">
        <h2 className="font-medium">日报尚未发布</h2>
        <p className="mt-1 text-sm text-stone-600">
          AIHOT 日报在北京时间 08:00 更新。{digest.daily_date ? `目前最新一期是 ${digest.daily_date}。` : ""}
        </p>
      </section>
    );
  }
  if (digest.daily_status === "error") {
    return (
      <section className="mt-6 rounded-2xl border border-rule bg-white/60 p-4">
        <h2 className="font-medium">日报暂时没有读到</h2>
        <p className="mt-1 text-sm text-stone-600">{digest.daily_lead}</p>
      </section>
    );
  }
  const href = safeUrl(digest.daily_url);
  return (
    <section className="mt-6 rounded-2xl border border-rule bg-white/70 p-4">
      <h2 className="font-medium">今日日报</h2>
      {digest.daily_lead ? <p className="mt-2 leading-7 text-stone-700">{digest.daily_lead}</p> : null}
      {href ? (
        <a href={href} className="mt-3 inline-block text-sm text-cinnabar">
          在 AIHOT 阅读 {digest.daily_date}
        </a>
      ) : null}
    </section>
  );
}

function NewsCard({ item, entries }: { item: NewsRow; entries: EntryLink[] }) {
  const aihot = safeUrl(item.link_aihot);
  const original = safeUrl(item.link_original);
  return (
    <section className="py-7">
      <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
        <span className="rounded-full bg-white px-2 py-1">{categoryLabel(item.category)}</span>
        {item.change_kind === "updated" ? <span className="rounded-full bg-white px-2 py-1">有更新</span> : null}
        <span>{item.source_name}</span>
        <span>{formatShanghai(item.published_at || item.discovered_at, false)}</span>
      </div>
      <h2 className="mt-3 font-serif text-2xl leading-snug">
        {aihot ? (
          <a href={aihot} className="text-ink no-underline hover:text-cinnabar">
            {item.title}
          </a>
        ) : (
          item.title
        )}
      </h2>
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
        <details className="mt-5 rounded-2xl bg-white/70 p-4">
          <summary className="cursor-pointer font-medium">补充词条 · {entries.length}</summary>
          <ul className="mt-4 space-y-4">
            {entries.map((entry) => {
              const wiki = safeUrl(entry.wiki_url);
              return (
                <li key={entry.id} className="border-t border-rule pt-4 first:border-t-0 first:pt-0">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <Link href={`/glossary/${entry.slug}`} className="font-serif text-lg text-ink no-underline hover:text-cinnabar">
                      {entry.name}
                    </Link>
                    <span className="text-xs text-stone-500">{kindLabel(entry.kind)}</span>
                    {entry.status !== "verified" ? (
                      <span className="text-xs text-cinnabar">{statusLabel(entry.status)}</span>
                    ) : null}
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
    </section>
  );
}
