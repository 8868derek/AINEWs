import Link from "next/link";
import { RunButton } from "@/components/RunButton";

const links = [
  { href: "/", label: "简报" },
  { href: "/library", label: "素材" },
  { href: "/digests", label: "往期" },
  { href: "/glossary", label: "词条" },
  { href: "/status", label: "状态" },
];

export function SiteHeader() {
  return (
    <header className="border-b border-rule">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4 px-5 py-5">
        <Link href="/" className="flex items-center gap-3 no-underline">
          <span className="grid h-10 w-10 place-items-center bg-cinnabar font-serif text-lg text-white">简</span>
          <span>
            <span className="block font-serif text-xl leading-none">团队 AI 简报</span>
            <span className="mt-1 block text-xs tracking-wide text-stone-500">每天 8:00 与 14:00 · 北京时间</span>
          </span>
        </Link>
        <div className="flex flex-wrap items-center gap-4">
          <nav className="flex gap-4 text-sm">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="text-stone-700 no-underline hover:text-cinnabar">
                {link.label}
              </Link>
            ))}
          </nav>
          <RunButton compact />
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mx-auto max-w-3xl px-5 py-10 text-sm leading-6 text-stone-500">
      新闻标题、摘要、推荐理由与日报导读来自{" "}
      <a href="https://aihot.news" className="text-cinnabar">
        AIHOT
      </a>
      的聚合与精选。本站只做团队阅读和中文补充词条。
    </footer>
  );
}
