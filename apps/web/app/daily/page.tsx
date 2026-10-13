import { api } from "@/lib/api";
import { safeUrl } from "@ainews/shared";

export const dynamic = "force-dynamic";

type ReportItem = {
  title?: string;
  summary?: string | null;
  source?: { name?: string };
  links?: { original?: string };
};

type StoredDaily = {
  date?: string;
  lead?: string | { title?: string | null; leadParagraph?: string | null } | null;
  sections?: Array<{ label?: string; summary?: string | null; items?: ReportItem[] }>;
};

function dailyLead(report: StoredDaily) {
  const lead = report.lead;
  if (typeof lead === "string" && lead.trim()) return lead.trim();
  if (lead && typeof lead === "object") {
    const paragraph = typeof lead.leadParagraph === "string" ? lead.leadParagraph.trim() : "";
    const title = typeof lead.title === "string" ? lead.title.trim() : "";
    if (paragraph) return paragraph;
    if (title) return title;
  }
  return "";
}

export default async function DailyPage() {
  const data = await api<{ doc: { payload: string } | null }>("/v1/corpus/daily");
  const doc = data.doc;
  let report: StoredDaily | null = null;
  if (doc) {
    try {
      report = JSON.parse(doc.payload) as StoredDaily;
    } catch {
      report = null;
    }
  }
  const lead = report ? dailyLead(report) : "";
  return (
    <section>
      <h1 className="font-serif text-4xl">日报</h1>
      <p className="mt-3 text-sm text-stone-600">{report?.date ? report.date : "还没有日报。更新一次后会出现。"}</p>
      {lead ? <p className="mt-6 text-lg leading-8">{lead}</p> : null}
      <div className="mt-8 space-y-10">
        {(report?.sections ?? []).map((section) => (
          <section key={section.label || "section"}>
            <h2 className="font-serif text-2xl">{section.label}</h2>
            {section.summary ? <p className="mt-2 text-sm text-stone-600">{section.summary}</p> : null}
            <div className="mt-4 divide-y divide-rule">
              {(section.items ?? []).map((item) => {
                const href = safeUrl(item.links?.original);
                return (
                  <article key={item.title} className="py-4">
                    {href ? (
                      <a href={href} className="font-serif text-xl text-ink no-underline hover:text-cinnabar">
                        {item.title}
                      </a>
                    ) : (
                      <p className="font-serif text-xl">{item.title}</p>
                    )}
                    {item.summary ? <p className="mt-2 leading-7 text-stone-700">{item.summary}</p> : null}
                    {item.source?.name ? <p className="mt-1 text-sm text-stone-500">{item.source.name}</p> : null}
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
