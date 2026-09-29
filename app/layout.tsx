import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: "团队 AI 简报",
  description: "每天两次阅读 AIHOT 精选，并为中文读者补充人物和机构词条。",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen font-sans antialiased">
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-5 py-8">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
