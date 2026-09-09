"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

type StoreOption = { slug: string; name: string; colorKey: string };

export default function StoreFilter({ stores }: { stores: StoreOption[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("store") ?? "all";

  const linkFor = (slug: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (slug === "all") params.delete("store");
    else params.set("store", slug);
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  return (
    <div className="store-filter-wrap">
      <div className="side-block-label">店舗フィルター</div>
      <div className="store-filter">
        <Link href={linkFor("all")} className={`store-btn${current === "all" ? " active" : ""}`}>
          <span className="dot" style={{ background: "var(--gold)" }} />
          全店舗
        </Link>
        {stores.map((s) => (
          <Link key={s.slug} href={linkFor(s.slug)} className={`store-btn${current === s.slug ? " active" : ""}`}>
            <span className="dot" style={{ background: `var(--store-${s.colorKey})` }} />
            {s.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
