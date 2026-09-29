import { notFound } from "next/navigation";
import { DigestView } from "@/components/DigestView";
import { digestNews, entriesForNews, getDigest } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function DigestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const digestId = Number(id);
  if (!Number.isInteger(digestId)) notFound();
  const digest = getDigest(digestId);
  if (!digest) notFound();
  const items = digestNews(digest.id);
  return <DigestView digest={digest} items={items} entries={entriesForNews(items.map((item) => item.id))} />;
}
