"use client";

import Link from "next/link";
import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { RunButton } from "@/components/RunButton";
import { FEED_CATEGORIES } from "@/lib/categories";

const contentLinks = [
  { href: "/", label: "简报", match: "home" },
  { href: "/library?mode=selected", label: "精选", match: "selected" },
  { href: "/library", label: "全部动态", match: "all" },
  { href: "/hot", label: "热点", match: "path" },
  { href: "/daily", label: "日报", match: "path" },
  { href: "/digests", label: "往期", match: "path" },
];

export function SiteSidebar() {
  return (
    <Suspense fallback={<aside className="w-60 shrink-0 border-r border-rule" />}>
      <SidebarNav />
    </Suspense>
  );
}

function SidebarNav() {
  const pathname = usePathname();
  const params = useSearchParams();
  const category = params.get("category") || "";
  const selected = params.get("mode") === "selected";

  function activeContent(match: string, href: string) {
    if (match === "home") return pathname === "/";
    if (match === "selected") return pathname === "/library" && selected && !category;
    if (match === "all") return pathname === "/library" && !selected && !category;
    const path = href.split("?")[0];
    return pathname === path || pathname.startsWith(`${path}/`);
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col overflow-y-auto border-r border-rule bg-paper/80 px-3 py-5 md:sticky md:top-0 md:h-screen">
      <Link href="/" className="flex items-center gap-3 px-2 no-underline">
        <span className="grid h-9 w-9 shrink-0 place-items-center bg-cinnabar font-serif text-lg text-white">简</span>
        <span>
          <span className="block font-serif text-lg leading-none">团队 AI 简报</span>
          <span className="mt-1 block text-xs text-stone-500">8:00 与 14:00</span>
        </span>
      </Link>

      <Group label="内容">
        {contentLinks.map((link) => (
          <Item key={link.href} href={link.href} active={activeContent(link.match, link.href)}>
            {link.label}
          </Item>
        ))}
      </Group>

      <Group label="分类">
        {FEED_CATEGORIES.map((item) => (
          <Item key={item.id} href={`/library?category=${item.id}`} active={pathname === "/library" && category === item.id}>
            {item.label}
          </Item>
        ))}
      </Group>

      <Group label="模型">
        <Item href="/codex" active={pathname === "/codex"}>
          Codex 重置
        </Item>
        <a
          href="https://aihot.news/leaderboard"
          className="flex h-9 items-center rounded-lg px-3 text-sm text-stone-600 no-underline hover:bg-white hover:text-ink"
        >
          模型榜
        </a>
      </Group>

      <Group label="本站">
        <Item href="/glossary" active={pathname === "/glossary" || pathname.startsWith("/glossary/")}>
          词条
        </Item>
        <Item href="/status" active={pathname === "/status"}>
          状态
        </Item>
      </Group>

      <div className="mt-6 px-2">
        <RunButton />
      </div>
      <p className="mt-auto px-3 pt-8 text-xs leading-5 text-stone-500">
        材料来自{" "}
        <a href="https://aihot.news" className="text-cinnabar">
          AIHOT
        </a>
        。模型榜只有网页，所以链到原站。
      </p>
    </aside>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <p className="px-3 pb-1 text-[11px] text-stone-500">{label}</p>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function Item({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`flex h-9 items-center rounded-lg px-3 text-sm no-underline ${active ? "bg-white font-medium text-ink" : "text-stone-600 hover:bg-white hover:text-ink"}`}
    >
      {children}
    </Link>
  );
}
