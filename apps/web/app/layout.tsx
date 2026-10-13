import type { Metadata } from "next";
import { SiteSidebar } from "@/components/SiteHeader";
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
        <div className="flex min-h-screen">
          <SiteSidebar />
          <main className="min-w-0 flex-1 px-6 py-8 md:px-10">
            <div className="mx-auto max-w-3xl">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
