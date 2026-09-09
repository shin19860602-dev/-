"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { DashboardIcon, SalesIcon, KarteIcon, SettingsIcon, AnalyticsIcon } from "./NavIcons";

// 現場での使用頻度順：売上入力が最優先、次にカルテ、次に集計・分析
const ITEMS = [
  { href: "/sales", label: "売上", Icon: SalesIcon, ownerOnly: false, group: ["/sales"] },
  { href: "/karte", label: "カルテ", Icon: KarteIcon, ownerOnly: false, group: ["/karte"] },
  { href: "/analytics", label: "集計・分析", Icon: AnalyticsIcon, ownerOnly: true, group: ["/analytics"] },
  { href: "/dashboard", label: "ダッシュボード", Icon: DashboardIcon, ownerOnly: false, group: ["/dashboard"] },
  { href: "/menu", label: "設定", Icon: SettingsIcon, ownerOnly: false, group: ["/staff", "/menu"] },
];

export default function NavLinks({ isOwner }: { isOwner: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qs = searchParams.toString();

  return (
    <nav className="mainnav">
      {ITEMS.filter((i) => !i.ownerOnly || isOwner).map(({ href, label, Icon, group }) => {
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
