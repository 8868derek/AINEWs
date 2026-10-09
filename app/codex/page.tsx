import { latestCorpusDoc } from "@/lib/queries";

export const dynamic = "force-dynamic";

type CodexEvent = {
  id?: string;
  title?: string;
  displayLabel?: string;
  status?: string;
  scope?: string;
};

export default function CodexPage() {
  const doc = latestCorpusDoc("codex");
  const payload = doc ? (JSON.parse(doc.payload) as { today?: string; events?: CodexEvent[] }) : null;
  const events = payload?.events ?? [];
  return (
    <section>
      <h1 className="font-serif text-4xl">Codex 重置</h1>
      <p className="mt-3 text-sm text-stone-600">{payload?.today ? `最近核对：${payload.today}` : "还没有记录。更新一次后会出现。"}</p>
      <div className="mt-8 divide-y divide-rule">
        {events.map((event) => (
          <article key={event.id || event.title} className="py-4">
            <h2 className="font-serif text-2xl">{event.title || event.displayLabel}</h2>
            <p className="mt-1 text-sm text-stone-500">
              {[event.displayLabel, event.scope, event.status].filter(Boolean).join(" · ")}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
