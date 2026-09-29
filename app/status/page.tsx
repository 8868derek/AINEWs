import { runtimeStatus } from "@/lib/queries";
import { formatShanghai, slotLabel } from "@/lib/time";

export const dynamic = "force-dynamic";

export default function StatusPage() {
  const status = runtimeStatus();
  return (
    <section>
      <h1 className="font-serif text-4xl">运行状态</h1>
      <dl className="mt-8 divide-y divide-rule">
        <Row label="模型" value={status.llmConfigured ? `已配置 · ${status.llmHost} · ${status.llmModel}` : "未配置。填写 .env.local 里的 LLM_BASE_URL、LLM_API_KEY、LLM_MODEL 后重启。"} />
        <Row label="词条检索" value="维基百科官方接口，无需密钥。" />
        <Row label="上次成功" value={status.lastSuccessAt ? formatShanghai(status.lastSuccessAt) : "还没有"} />
        <Row label="下一次" value={`${slotLabel(status.nextSlot)} · ${formatShanghai(status.nextAt)}`} />
        <Row label="资料库" value={`${status.digestCount} 期更新 · ${status.entryCount} 条词条。新闻存在 SQLite 文件 data/app.sqlite，这是数据库，文件在磁盘上。`} />
        <Row label="最近错误" value={status.lastError || "没有"} />
      </dl>
      <p className="mt-8 leading-7 text-stone-600">
        打开页面读的是已经写好的资料库，不用每次手动更新。8:00 和 14:00 会自动再拉一次。部署时把 <code>data</code> 目录挂到持久磁盘，重建容器后新闻还在。
      </p>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 py-4 sm:grid-cols-[8rem_1fr]">
      <dt className="text-sm text-stone-500">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
