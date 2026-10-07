import type { Metadata } from "next";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import "./globals.css";
import "@/styles/ui-tokens.css";
import "@/styles/story.css";
import "@/styles/decision-workspace.css";
import "@/styles/visual-decisions.css";
import "@/styles/smart-query.css";
import "@/styles/store-planning.css";
import "@/styles/profit-analysis.css";
import "@/styles/workspace-layout.css";
import "@/styles/vessel-workspace.css";
import "@/styles/vessel-overview.css";
import "@/styles/vessel-orders.css";
import "@/styles/vessel-replenishment.css";
import "@/styles/skill-entry.css";
import "@/styles/daily-dispatch.css";
export const metadata: Metadata = {
  title: "ATLAS · 吉达单港供应保障 Agent",
  description:
    "从 2,500 台船次分车与物流执行，到每日订单调拨的 CUI + GUI 演示。",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
