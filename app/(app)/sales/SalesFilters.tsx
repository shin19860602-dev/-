"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

type StaffOption = { id: string; name: string };

const PERIODS: { value: string; label: string }[] = [
  { value: "today", label: "期間：本日" },
  { value: "week", label: "期間：今週" },
  { value: "month", label: "期間：今月" },
  { value: "lastmonth", label: "期間：先月" },
];

export default function SalesFilters({ staffOptions }: { staffOptions: StaffOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const set = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!value) params.delete(key);
    else params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <>
      <select className="chip-select" value={searchParams.get("period") ?? "month"} onChange={(e) => set("period", e.target.value)}>
        {PERIODS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
      <select className="chip-select" value={searchParams.get("staff") ?? ""} onChange={(e) => set("staff", e.target.value)}>
        <option value="">担当：全員</option>
        {staffOptions.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </>
  );
}
