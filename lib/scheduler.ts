import cron from "node-cron";
import { one, stateGet } from "@/lib/db";
import { runDigest } from "@/lib/digest";
import { shanghaiLocalToDate, shanghaiParts } from "@/lib/time";

const globalForScheduler = globalThis as unknown as { ainewsScheduler?: boolean };

function lastDueSlot(now = new Date()) {
  const parts = shanghaiParts(now);
  if (parts.hour > 14 || (parts.hour === 14 && parts.minute >= 0)) {
    return shanghaiLocalToDate(parts.year, parts.month, parts.day, 14, 0);
  }
  if (parts.hour > 8 || (parts.hour === 8 && parts.minute >= 0)) {
    return shanghaiLocalToDate(parts.year, parts.month, parts.day, 8, 0);
  }
  const yesterday = shanghaiParts(new Date(shanghaiLocalToDate(parts.year, parts.month, parts.day, 0, 0).getTime() - 24 * 60 * 60 * 1000));
  return shanghaiLocalToDate(yesterday.year, yesterday.month, yesterday.day, 14, 0);
}

export function startScheduler() {
  if (globalForScheduler.ainewsScheduler) return;
  globalForScheduler.ainewsScheduler = true;
  const run = (slot: string) => {
    void runDigest("schedule").catch((error: unknown) => {
      console.error(`[ainews] ${slot}更新失败`, error);
    });
  };
  cron.schedule("0 8 * * *", () => run("早报"), { timezone: "Asia/Shanghai" });
  cron.schedule("0 14 * * *", () => run("午后报"), { timezone: "Asia/Shanghai" });

  const count = one<{ n: number }>("SELECT COUNT(*) AS n FROM news_items")?.n ?? 0;
  const last = stateGet("last_success_at");
  const due = lastDueSlot();
  if (count === 0 || !last || new Date(last).getTime() < due.getTime()) {
    run("启动补齐");
  }
}
