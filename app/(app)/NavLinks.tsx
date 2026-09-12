"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { DashboardIcon, SalesIcon, KarteIcon, SettingsIcon, AnalyticsIcon, PayrollIcon } from "./NavIcons";

const SALES = { href: "/sales", label: "売上", Icon: SalesIcon, ownerOnly: false, group: ["/sales"] };
const KARTE = { href: "/karte", label: "カルテ", Icon: KarteIcon, ownerOnly: false, group: ["/karte"] };
const ANALYTICS = { href: "/analytics", label: "集計・分析", Icon: AnalyticsIcon, ownerOnly: true, group: ["/analytics"] };
const DASHBOARD = { href: "/dashboard", label: "ダッシュボード", Icon: DashboardIcon, ownerOnly: false, group: ["/dashboard"] };
const SETTINGS = { href: "/menu", label: "設定", Icon: SettingsIcon, ownerOnly: false, group: ["/staff", "/menu", "/payroll"] };
const PAYROLL = { href: "/payroll", label: "給料", Icon: PayrollIcon, ownerOnly: true, group: ["/payroll"] };

// スタッフ：現場での使用頻度順（売上入力が最優先、次にカルテ）
const STAFF_ITEMS = [SALES, KARTE, ANALYTICS, DASHBOARD, SETTINGS];
// オーナー：全店舗の状況を見るダッシュボードが最優先、カルテ登録は下の方でよい
const OWNER_ITEMS = [DASHBOARD, SALES, ANALYTICS, KARTE, PAYROLL, SETTINGS];

export default function NavLinks({ isOwner }: { isOwner: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const items = isOwner ? OWNER_ITEMS : STAFF_ITEMS;

  return (
    <nav className="mainnav">
      {items.filter((i) => !i.ownerOnly || isOwner).map(({ href, label, Icon, group }) => {
        const active = group.includes(pathname);
        return (
          <Link key={href} href={qs ? `${href}?${qs}` : href} className={`nav-item${active ? " active" : ""}`}>
            <Icon />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
