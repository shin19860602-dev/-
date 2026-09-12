"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const TABS = [
  { href: "/menu", label: "メニュー" },
  { href: "/staff", label: "スタッフ" },
  { href: "/payroll", label: "給料" },
];

export default function SettingsTabs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qs = searchParams.toString();

  return (
    <div className="filters" style={{ marginBottom: 16 }}>
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link key={t.href} href={qs ? `${t.href}?${qs}` : t.href} className={active ? "btn-primary" : "btn-ghost"}>
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
