import { TeamBriefView } from "@/components/TeamBrief";
import { WaitingRefresh } from "@/components/WaitingRefresh";
import { api } from "@/lib/api";
import { parseBrief, type DigestRow } from "@ainews/shared";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const data = await api<{ digest: DigestRow | null; newsCount: number }>("/v1/home");
  const brief = parseBrief(data.digest?.brief_json);
  if (!brief && data.newsCount === 0) {
    return (
      <section className="py-8">
        <p className="text-sm text-cinnabar">还没有简报</p>
        <h1 className="mt-3 font-serif text-4xl leading-tight">更新完成后，这里会按制造与供应链、基础模型和行业热门写成简报。</h1>
        <WaitingRefresh />
      </section>
    );
  }
  if (!brief) {
    return (
      <section className="py-8">
        <h1 className="font-serif text-4xl">这期还没有团队简报</h1>
        <p className="mt-3 leading-7 text-stone-600">点「立即更新」，会从近 24 小时的材料里按团队侧重点挑一版。链接用原文。</p>
      </section>
    );
  }
  return <TeamBriefView brief={brief} ranAt={data.digest?.ran_at} slot={data.digest?.slot} />;
}
