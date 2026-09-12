"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createMenuItem } from "./actions";
import { sanitizeAmountInput } from "@/lib/format";

const PLACEHOLDER: Record<"service" | "menu" | "product", string> = {
  service: "新しいクーポン名",
  menu: "新しいメニュー名",
  product: "新しい商品名",
};

export default function AddMenuItemForm({ storeId, type }: { storeId: string; type: "service" | "menu" | "product" }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      style={{ display: "flex", gap: 8, marginTop: 10 }}
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await createMenuItem(formData);
          if (result.ok) {
            formRef.current?.reset();
            router.refresh();
          } else {
            setError(result.error);
          }
        });
      }}
    >
      <input type="hidden" name="storeId" value={storeId} />
      <input type="hidden" name="type" value={type} />
      <input className="field-input" name="name" placeholder={PLACEHOLDER[type]} required style={{ flex: 1 }} />
      <input
        className="field-input"
        name="price"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        placeholder="金額"
        required
        style={{ width: 110 }}
        onChange={sanitizeAmountInput}
      />
      <button className="btn-primary" type="submit" disabled={pending} style={{ whiteSpace: "nowrap" }}>
        追加
      </button>
      {error && <span style={{ color: "var(--bad)", fontSize: 12, alignSelf: "center" }}>{error}</span>}
    </form>
  );
}
