"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const TABS = [
  { href: "/menu", label: "メニュー" },
  { href: "/staff", label: "スタッフ" },
  { href: "/payroll", label: "給料" },
  { href: "/payroll/savings", label: "貯金", ownerOnly: true },
];

export default function SettingsTabs({ isOwner = false }: { isOwner?: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qs = searchParams.toString();

  return (
    <div className="filters" style={{ marginBottom: 16 }}>
      {TABS.filter((t) => !t.ownerOnly || isOwner).map((t) => {
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
