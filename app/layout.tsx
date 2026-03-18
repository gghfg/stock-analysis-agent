import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stock Analysis Agent - 股票智能分析",
  description: "输入股票代码，通过多 Agent 并行分析生成深度研报",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
