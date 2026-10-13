import { notFound } from "next/navigation";
import { formatShanghai, kindLabel, safeUrl, statusLabel, type GlossaryEntry, type NewsRow } from "@ainews/shared";

export const dynamic = "force-dynamic";

export default async function GlossaryEntryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const response = await fetch(`${process.env.API_URL?.replace(/\/$/, "")}/v1/glossary/${encodeURIComponent(slug)}`, {
    headers: process.env.API_TOKEN ? { Authorization: `Bearer ${process.env.API_TOKEN}` } : {},
    cache: "no-store",
  });
  if (response.status === 404) notFound();
  if (!response.ok) throw new Error("词条没有读出来");
  const data = (await response.json()) as { entry: GlossaryEntry; news: Array<NewsRow & { context_note: string }> };
  const entry = data.entry;
  const related = data.news;
  const wiki = safeUrl(entry.wiki_url);
  let aliases: string[] = [];
  try {
    const parsed = JSON.parse(entry.aliases) as unknown;
    if (Array.isArray(parsed)) aliases = parsed.filter((item): item is string => typeof item === "string");
  } catch {
    aliases = [];
  }
  return (
    <article>
      <p className="text-sm text-cinnabar">
        {kindLabel(entry.kind)} · {statusLabel(entry.status)}
      </p>
      <h1 className="mt-2 font-serif text-4xl">{entry.name}</h1>
      {aliases.length > 0 ? <p className="mt-2 text-sm text-stone-500">{aliases.join("、")}</p> : null}
      <p className="mt-5 leading-8 text-lg text-stone-800">{entry.summary_zh}</p>
      {wiki ? (
        <a href={wiki} className="mt-4 inline-block text-cinnabar">
          维基百科{entry.wiki_title ? ` · ${entry.wiki_title}` : ""}
        </a>
      ) : null}
      <h2 className="mt-10 font-serif text-2xl">相关新闻</h2>
      {related.length === 0 ? <p className="mt-3 text-stone-600">还没有关联新闻。</p> : null}
      <ul className="mt-4 space-y-4">
        {related.map((item) => (
          <li key={item.id} className="rounded-2xl border border-rule bg-white/60 p-4">
            {safeUrl(item.link_aihot) ? (
              <a href={safeUrl(item.link_aihot)!} className="font-medium text-ink no-underline hover:text-cinnabar">
                {item.title}
              </a>
            ) : (
              <p className="font-medium">{item.title}</p>
            )}
            <p className="mt-1 text-xs text-stone-500">{formatShanghai(item.discovered_at)}</p>
            <p className="mt-2 text-sm leading-6 text-stone-600">{item.context_note}</p>
          </li>
        ))}
      </ul>
    </article>
  );
}
