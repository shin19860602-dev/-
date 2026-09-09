import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "貝 | サロン管理ソフト",
  description: "美容室・まつ毛エクステサロンの売上・カルテ・スタッフ管理",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
