import type { Metadata } from "next";
import "./globals.css";
import "@/styles/story.css";
export const metadata: Metadata = {
  title: "ATLAS · 吉达单港供应保障 Agent",
  description: "从 1,800 台船次分车与物流执行，到每日订单调拨的 CUI + GUI 演示。",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
