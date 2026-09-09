"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setStaffActive } from "./actions";

export default function StaffToggleButton({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="btn-ghost"
      style={{ padding: "6px 12px", fontSize: 11.5 }}
      disabled={pending}
      onClick={() => {
        if (active && !confirm("このスタッフを退職・非表示にしますか？過去の売上・カルテ記録は残ります。")) return;
        startTransition(async () => {
          await setStaffActive(id, !active);
          router.refresh();
        });
      }}
    >
      {active ? "退職・非表示にする" : "復帰させる"}
    </button>
  );
}
