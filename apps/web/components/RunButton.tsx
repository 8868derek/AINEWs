"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RunButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setPending(true);
    setError(null);
    try {
      const before = (await fetch("/api/status").then((response) => response.json())) as { lastSuccessAt?: string | null; lastError?: string | null };
      const response = await fetch("/api/digests/run", { method: "POST" });
      const data = (await response.json()) as { ok?: boolean; accepted?: boolean; error?: string };
      if (!response.ok || data.ok === false) {
        setError(data.error || "更新失败");
        return;
      }
      const started = Date.now();
      while (Date.now() - started < 180000) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const status = (await fetch("/api/status").then((item) => item.json())) as { lastSuccessAt?: string | null; lastError?: string | null };
        if (status.lastSuccessAt && status.lastSuccessAt !== before.lastSuccessAt) {
          router.refresh();
          return;
        }
        if (status.lastError && status.lastError !== before.lastError) {
          setError(status.lastError);
          router.refresh();
          return;
        }
      }
      setError("更新还在进行，过一会儿再刷新。");
    } catch {
      setError("更新没有完成，请再试一次");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={compact ? "text-right" : "space-y-2"}>
      <button
        type="button"
        onClick={run}
        disabled={pending}
        aria-busy={pending}
        className="rounded-full bg-cinnabar px-4 py-2 text-sm font-medium text-white disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? "正在更新…" : "立即更新"}
      </button>
      {pending ? <p className="mt-2 text-sm text-stone-600">正在整理制造与供应链、基础模型和行业热门。</p> : null}
      {error ? <p className="mt-2 text-sm text-cinnabar">{error}</p> : null}
    </div>
  );
}
