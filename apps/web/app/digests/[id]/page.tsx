import { notFound } from "next/navigation";
import { DigestView } from "@/components/DigestView";
import type { DigestRow, EntryLink, NewsRow } from "@/lib/shared";
import { apiFetch, asEntryMap } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function DigestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const response = await apiFetch(`/v1/digests/${id}`);
  if (response.status === 404) notFound();
  const data = (await response.json()) as { digest: DigestRow; items: NewsRow[]; entries: Record<string, EntryLink[]> };
  if (!response.ok) throw new Error("这一期没有读出来");
  return <DigestView digest={data.digest} items={data.items} entries={asEntryMap(data.entries)} />;
}
