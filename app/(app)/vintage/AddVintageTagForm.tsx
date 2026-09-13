"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createVintageTag } from "./actions";

const PLACEHOLDER: Record<"category" | "brand", string> = {
  category: "新しい分類名",
  brand: "新しいブランド名",
};

export default function AddVintageTagForm({ storeId, kind }: { storeId: string; kind: "category" | "brand" }) {
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
          const result = await createVintageTag(formData);
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
      <input type="hidden" name="kind" value={kind} />
      <input className="field-input" name="name" placeholder={PLACEHOLDER[kind]} required style={{ flex: 1 }} />
      <button className="btn-primary" type="submit" disabled={pending} style={{ whiteSpace: "nowrap" }}>
        追加
      </button>
      {error && <span style={{ color: "var(--bad)", fontSize: 12, alignSelf: "center" }}>{error}</span>}
    </form>
  );
}
