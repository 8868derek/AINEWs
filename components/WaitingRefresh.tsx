"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function WaitingRefresh() {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 8000);
    return () => clearInterval(timer);
  }, [router]);
  return (
    <p className="mt-4 leading-7 text-stone-600">
      服务正在把 AIHOT 精选写入本地资料库。写完后页面会自己出现，不用点「立即更新」。
    </p>
  );
}
