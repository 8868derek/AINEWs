export type Slot = "morning" | "afternoon";

export type ShanghaiParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  date: string;
};

export function shanghaiParts(date = new Date()): ShanghaiParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const year = read("year");
  const month = read("month");
  const day = read("day");
  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(read("hour")),
    minute: Number(read("minute")),
    date: `${year}-${month}-${day}`,
  };
}

export function shanghaiLocalToDate(year: number, month: number, day: number, hour: number, minute = 0) {
  return new Date(Date.UTC(year, month - 1, day, hour - 8, minute, 0));
}

export function slotFor(date = new Date()): Slot {
  return shanghaiParts(date).hour < 14 ? "morning" : "afternoon";
}

export function defaultCutoff(slot: Slot, now = new Date()) {
  const parts = shanghaiParts(now);
  if (slot === "afternoon") {
    return shanghaiLocalToDate(parts.year, parts.month, parts.day, 8, 0);
  }
  const yesterday = new Date(shanghaiLocalToDate(parts.year, parts.month, parts.day, 0, 0).getTime() - 24 * 60 * 60 * 1000);
  const previous = shanghaiParts(yesterday);
  return shanghaiLocalToDate(previous.year, previous.month, previous.day, 14, 0);
}

export function nextRun(now = new Date()) {
  const parts = shanghaiParts(now);
  const morning = shanghaiLocalToDate(parts.year, parts.month, parts.day, 8, 0);
  const afternoon = shanghaiLocalToDate(parts.year, parts.month, parts.day, 14, 0);
  if (now.getTime() < morning.getTime()) return { slot: "morning" as const, at: morning };
  if (now.getTime() < afternoon.getTime()) return { slot: "afternoon" as const, at: afternoon };
  return { slot: "morning" as const, at: new Date(morning.getTime() + 24 * 60 * 60 * 1000) };
}

export function shanghaiDateKey(iso: string) {
  return shanghaiParts(new Date(iso)).date;
}

export function dayHeading(dateKey: string, now = new Date()) {
  const today = shanghaiParts(now).date;
  const yesterday = shanghaiParts(new Date(shanghaiLocalToDate(shanghaiParts(now).year, shanghaiParts(now).month, shanghaiParts(now).day, 0, 0).getTime() - 24 * 60 * 60 * 1000)).date;
  const label = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${dateKey}T12:00:00+08:00`));
  if (dateKey === today) return `今天 · ${label}`;
  if (dateKey === yesterday) return `昨天 · ${label}`;
  return label;
}

export function clockTime(iso: string) {
  const parts = shanghaiParts(new Date(iso));
  return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

export function formatShanghai(iso: string, withDate = true) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: withDate ? "numeric" : undefined,
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

export function slotLabel(slot: string) {
  return slot === "afternoon" ? "午后报" : "早报";
}
