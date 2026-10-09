import type { TeamBrief } from "@/lib/brief";
import { safeUrl } from "@/lib/queries";
import { formatShanghai, slotLabel } from "@/lib/time";

export function TeamBriefView({
  brief,
  ranAt,
  slot,
}: {
  brief: TeamBrief;
  ranAt?: string | null;
  slot?: string | null;
}) {
  return (
    <article className="space-y-8">
      <header>
        <p className="text-sm text-cinnabar">{slot ? slotLabel(slot) : "团队简报"}</p>
        <h1 className="mt-2 font-serif text-4xl">制造业 AI 简报</h1>
        {ranAt ? <p className="mt-3 text-sm text-stone-500">{formatShanghai(ranAt)}</p> : null}
        <p className="mt-4 text-lg leading-8 text-stone-800">{brief.lead}</p>
      </header>
      {brief.sections.length === 0 ? <p className="text-stone-600">这期没有挑出相关条目。</p> : null}
      {brief.sections.map((section) => (
        <section key={section.heading}>
          <h2 className="border-b border-rule pb-2 font-serif text-2xl">{section.heading}</h2>
          <div className="divide-y divide-rule">
            {section.items.map((item) => {
              const href = safeUrl(item.url);
              return (
                <article key={`${section.heading}-${item.url}`} className="py-5">
                  <h3 className="font-serif text-2xl leading-snug">
                    {href ? (
                      <a href={href} className="text-ink no-underline hover:text-cinnabar">
                        {item.title}
                      </a>
                    ) : (
                      item.title
                    )}
                  </h3>
                  <p className="mt-3 leading-7 text-stone-700">{item.point}</p>
                  {href ? (
                    <a href={href} className="mt-3 inline-block text-sm text-cinnabar">
                      {item.source || "原文"}
                    </a>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </article>
  );
}
