import cron from "node-cron";
import { runDigest } from "@/lib/digest";

const globalForScheduler = globalThis as unknown as { ainewsScheduler?: boolean };

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
}
