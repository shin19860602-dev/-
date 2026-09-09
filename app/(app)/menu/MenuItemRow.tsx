"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setMenuItemActive } from "./actions";
import { yen } from "@/lib/analytics";

export default function MenuItemRow({
  id,
  name,
  price,
  active,
  canEdit,
}: {
  id: string;
  name: string;
  price: number;
  active: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="list-row">
      <div className="grow">
        <div className="title" style={{ opacity: active ? 1 : 0.5 }}>
          {name}
        </div>
        <div className="meta">{yen(price)}</div>
      </div>
      {canEdit && (
        <button
          type="button"
          className="btn-ghost"
          style={{ padding: "5px 12px", fontSize: 11.5 }}
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              await setMenuItemActive(id, !active);
              router.refresh();
            });
          }}
        >
          {active ? "非表示にする" : "再表示する"}
        </button>
      )}
    </div>
  );
}
