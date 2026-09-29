import Link from "next/link";
import { kindLabel, listGlossary, statusLabel } from "@/lib/queries";
import { formatShanghai } from "@/lib/time";

export const dynamic = "force-dynamic";

const kinds = [
  { id: "", label: "全部" },
  { id: "person", label: "人物" },
  { id: "org", label: "机构" },
  { id: "product", label: "产品" },
  { id: "term", label: "术语" },
];

export default async function GlossaryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kind?: string }>;
}) {
  const params = await searchParams;
  const kind = kinds.some((item) => item.id === params.kind) ? params.kind || "" : "";
  const query = params.q?.trim() || "";
  const entries = listGlossary(kind, query);
  return (
    <section>
      <h1 className="font-serif text-4xl">词条库</h1>
      <p className="mt-3 leading-7 text-stone-600">人物、机构和术语会留在这里。30 天内再次出现时直接复用。</p>
      <form className="mt-6 flex flex-wrap gap-2" action="/glossary">
        <input
          name="q"
          defaultValue={query}
          placeholder="搜索词条"
          className="min-w-48 flex-1 rounded-full border border-rule bg-white px-4 py-2"
        />
        <button type="submit" className="rounded-full border border-ink px-4 py-2 text-sm">
          搜索
        </button>
      </form>
      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        {kinds.map((item) => {
          const active = item.id === kind;
          const href = item.id ? `/glossary?kind=${item.id}${query ? `&q=${encodeURIComponent(query)}` : ""}` : `/glossary${query ? `?q=${encodeURIComponent(query)}` : ""}`;
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
      </div>
      {entries.length === 0 ? <p className="mt-8 text-stone-600">还没有词条。</p> : null}
      <ul className="mt-6 divide-y divide-rule">
        {entries.map((entry) => (
          <li key={entry.id} className="py-4">
            <Link href={`/glossary/${entry.slug}`} className="font-serif text-2xl text-ink no-underline hover:text-cinnabar">
              {entry.name}
            </Link>
            <p className="mt-1 text-xs text-stone-500">
              {kindLabel(entry.kind)} · {statusLabel(entry.status)} · {formatShanghai(entry.updated_at)}
            </p>
            <p className="mt-2 leading-7 text-stone-700">{entry.summary_zh}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
