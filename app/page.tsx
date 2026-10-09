import { TeamBriefView } from "@/components/TeamBrief";
import { WaitingRefresh } from "@/components/WaitingRefresh";
import { parseBrief } from "@/lib/brief";
import { latestDigest, storedNewsCount } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const latest = latestDigest();
  const brief = parseBrief(latest?.brief_json);
  if (!brief && storedNewsCount() === 0) {
    return (
      <section className="py-8">
        <p className="text-sm text-cinnabar">还没有简报</p>
        <h1 className="mt-3 font-serif text-4xl leading-tight">更新完成后，这里会按制造业 AI 赋能的侧重点写成简报。</h1>
        <WaitingRefresh />
      </section>
    );
  }
  if (!brief) {
    return (
      <section className="py-8">
        <h1 className="font-serif text-4xl">这期还没有团队简报</h1>
        <p className="mt-3 leading-7 text-stone-600">点「立即更新」，模型会从已经拉下来的材料里按侧重点重写一版。链接用原文。</p>
      </section>
    );
  }
  return <TeamBriefView brief={brief} ranAt={latest?.ran_at} slot={latest?.slot} />;
}
