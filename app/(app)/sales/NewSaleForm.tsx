"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createVisit } from "./actions";
import CustomerCombobox from "./CustomerCombobox";
import { sanitizeAmountInput } from "@/lib/format";

type Store = { id: string; name: string; colorKey: string };
type Customer = { id: string; name: string; storeId: string };
type MenuItem = { id: string; name: string; price: number; storeId: string };

// IME変換前（ひらがな入力中）の文字列だけを拾う。漢字から読みを推測するより、実際にタイプされたかなの方が正確。
const HIRAGANA_RE = /^[ぁ-ゖー]+$/;

export default function NewSaleForm({
  isOwner,
  fixedStoreId,
  stores,
  customers,
  couponMenus,
  menuMenus,
  productMenus,
}: {
  isOwner: boolean;
  fixedStoreId?: string;
  stores: Store[];
  customers: Customer[];
  couponMenus: MenuItem[];
  menuMenus: MenuItem[];
  productMenus: MenuItem[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const couponAmountRef = useRef<HTMLInputElement>(null);
  const menuAmountRef = useRef<HTMLInputElement>(null);
  const productAmountRef = useRef<HTMLInputElement>(null);
  const kanaRef = useRef<HTMLInputElement>(null);
  const kanaTouchedRef = useRef(false);
  const kanaBufferRef = useRef("");
  const lastHiraganaRef = useRef("");
  const [storeId, setStoreId] = useState(fixedStoreId ?? stores[0]?.id ?? "");
  const [customerMode, setCustomerMode] = useState<"existing" | "new">("existing");
  const [couponCustom, setCouponCustom] = useState(false);
  const [menuCustom, setMenuCustom] = useState(false);
  const [productCustom, setProductCustom] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "credit">("cash");
  const [pending, startTransition] = useTransition();

  const today = new Date();
  const defaultDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const customerOptions = useMemo(() => customers.filter((c) => c.storeId === storeId), [customers, storeId]);
  const couponOptions = useMemo(() => couponMenus.filter((m) => m.storeId === storeId), [couponMenus, storeId]);
  const menuOptions = useMemo(() => menuMenus.filter((m) => m.storeId === storeId), [menuMenus, storeId]);
  const productOptions = useMemo(() => productMenus.filter((m) => m.storeId === storeId), [productMenus, storeId]);

  // 技術売上＝クーポン金額＋メニュー金額の合計（表示のみ。実際の保存額はサーバー側で再計算する）
  function updateTechnicalTotal() {
    const coupon = Number(couponAmountRef.current?.value || "0") || 0;
    const menu = Number(menuAmountRef.current?.value || "0") || 0;
    if (amountRef.current) amountRef.current.value = String(coupon + menu);
  }

  return (
    <div className="card card-pad" style={{ marginBottom: 16 }}>
      <div className="card-title">売上を登録</div>
      {error && <div className="auth-error">{error}</div>}
      {justSaved && (
        <div className="card-sub" style={{ color: "var(--good)", fontWeight: 700 }}>
          登録しました。続けて次のお客様を入力できます。
        </div>
      )}
      <form
        ref={formRef}
        action={(formData) => {
          setError(null);
          setJustSaved(false);
          startTransition(async () => {
            const result = await createVisit(formData);
            if (result.ok) {
              formRef.current?.reset();
              setCustomerMode("existing");
              setCouponCustom(false);
              setMenuCustom(false);
              setProductCustom(false);
              setPaymentMethod("cash");
              kanaTouchedRef.current = false;
              kanaBufferRef.current = "";
              lastHiraganaRef.current = "";
              if (amountRef.current) amountRef.current.value = "";
              setFormKey((k) => k + 1);
              setJustSaved(true);
              router.refresh();
            } else {
              setError(result.error);
            }
          });
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 12 }}>
          {isOwner && !fixedStoreId ? (
            <div style={{ gridColumn: "span 2" }}>
              <label className="form-label">店舗</label>
              <select className="field-select" name="storeId" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <input type="hidden" name="storeId" value={storeId} />
          )}

          <div style={{ gridColumn: "span 2" }}>
            <label className="form-label">日付</label>
            <input key={formKey} className="field-input" type="date" name="date" defaultValue={defaultDate} required style={{ maxWidth: 200 }} />
          </div>

          <div style={{ gridColumn: "span 2" }}>
            <label className="form-label">お客様</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
              <button
                type="button"
                className={customerMode === "existing" ? "btn-primary" : "btn-ghost"}
                style={{ padding: "6px 12px", fontSize: 12 }}
                onClick={() => setCustomerMode("existing")}
              >
                既存のお客様
              </button>
              <button
                type="button"
                className={customerMode === "new" ? "btn-primary" : "btn-ghost"}
                style={{ padding: "6px 12px", fontSize: 12 }}
                onClick={() => setCustomerMode("new")}
              >
                ＋ 新しいお客様
              </button>
            </div>
            {customerMode === "existing" ? (
              <CustomerCombobox key={`${formKey}-${storeId}`} customers={customerOptions} name="customerId" placeholder="お名前で検索" />
            ) : (
              <div key={formKey} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    className="field-input"
                    name="newCustomerName"
                    placeholder="お客様のお名前"
                    required
                    style={{ flex: 1 }}
                    onCompositionUpdate={(e) => {
                      const data = e.data ?? "";
                      if (HIRAGANA_RE.test(data)) lastHiraganaRef.current = data;
                    }}
                    onCompositionEnd={() => {
                      if (lastHiraganaRef.current) {
                        kanaBufferRef.current += lastHiraganaRef.current;
                        lastHiraganaRef.current = "";
                        if (!kanaTouchedRef.current && kanaRef.current) {
                          kanaRef.current.value = kanaBufferRef.current;
                        }
                      }
                    }}
                    onChange={(e) => {
                      if (e.target.value === "") {
                        kanaBufferRef.current = "";
                        kanaTouchedRef.current = false;
                        if (kanaRef.current) kanaRef.current.value = "";
                      }
                    }}
                  />
                  <select className="field-select" name="newCustomerGender" defaultValue="female" style={{ width: 100 }}>
                    <option value="female">女性</option>
                    <option value="male">男性</option>
                    <option value="other">その他</option>
                  </select>
                </div>
                <input
                  ref={kanaRef}
                  className="field-input"
                  name="newCustomerKana"
                  placeholder="ふりがな（自動入力・修正できます）"
                  onChange={() => {
                    kanaTouchedRef.current = true;
                  }}
                />
              </div>
            )}
          </div>

          <div style={{ gridColumn: "span 2" }}>
            <label className="form-label">
              クーポン（任意）
              <button
                type="button"
                onClick={() => setCouponCustom((v) => !v)}
                style={{ marginLeft: 8, fontSize: 11, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                {couponCustom ? "一覧から選ぶ" : "自由入力に切替"}
              </button>
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              {couponCustom || couponOptions.length === 0 ? (
                <input className="field-input" name="couponName" placeholder="例：似合わせカット＋カラークーポン" style={{ flex: 1 }} />
              ) : (
                <select
                  className="field-select"
                  name="couponName"
                  defaultValue=""
                  style={{ flex: 1 }}
                  onChange={(e) => {
                    const item = couponOptions.find((m) => m.name === e.target.value);
                    if (item && couponAmountRef.current) {
                      couponAmountRef.current.value = String(item.price);
                      updateTechnicalTotal();
                    }
                  }}
                >
                  <option value="">選択しない</option>
                  {couponOptions.map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.name}（¥{m.price.toLocaleString("ja-JP")}）
                    </option>
                  ))}
                </select>
              )}
              <input
                ref={couponAmountRef}
                className="field-input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                name="couponAmount"
                placeholder="金額"
                style={{ width: 110 }}
                onChange={(e) => {
                  sanitizeAmountInput(e);
                  updateTechnicalTotal();
                }}
              />
            </div>
          </div>

          <div style={{ gridColumn: "span 2" }}>
            <label className="form-label">
              メニュー（任意）
              <button
                type="button"
                onClick={() => setMenuCustom((v) => !v)}
                style={{ marginLeft: 8, fontSize: 11, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                {menuCustom ? "一覧から選ぶ" : "自由入力に切替"}
              </button>
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              {menuCustom || menuOptions.length === 0 ? (
                <input className="field-input" name="menuName" placeholder="例：カット＋カラー" style={{ flex: 1 }} />
              ) : (
                <select
                  className="field-select"
                  name="menuName"
                  defaultValue=""
                  style={{ flex: 1 }}
                  onChange={(e) => {
                    const item = menuOptions.find((m) => m.name === e.target.value);
                    if (item && menuAmountRef.current) {
                      menuAmountRef.current.value = String(item.price);
                      updateTechnicalTotal();
                    }
                  }}
                >
                  <option value="">選択しない</option>
                  {menuOptions.map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.name}（¥{m.price.toLocaleString("ja-JP")}）
                    </option>
                  ))}
                </select>
              )}
              <input
                ref={menuAmountRef}
                className="field-input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                name="menuAmount"
                placeholder="金額"
                style={{ width: 110 }}
                onChange={(e) => {
                  sanitizeAmountInput(e);
                  updateTechnicalTotal();
                }}
              />
            </div>
          </div>

          <div>
            <label className="form-label">技術売上合計（円）</label>
            <input ref={amountRef} className="field-input" type="text" readOnly style={{ background: "var(--surface-muted)" }} />
          </div>
          <div>
            <label className="form-label">ポイント売上（円・任意）</label>
            <input
              className="field-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              name="pointAmount"
              onChange={sanitizeAmountInput}
            />
          </div>

          <div style={{ gridColumn: "span 2", borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: 2 }}>
            <label className="form-label" style={{ marginBottom: 8 }}>
              店販（任意）
              <button
                type="button"
                onClick={() => setProductCustom((v) => !v)}
                style={{ marginLeft: 8, fontSize: 11, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                {productCustom ? "一覧から選ぶ" : "自由入力に切替"}
              </button>
            </label>
          </div>
          <div style={{ gridColumn: "span 2" }}>
            {productCustom || productOptions.length === 0 ? (
              <input className="field-input" name="productName" placeholder="例：シャンプー" />
            ) : (
              <select
                className="field-select"
                name="productName"
                defaultValue=""
                onChange={(e) => {
                  const item = productOptions.find((m) => m.name === e.target.value);
                  if (item && productAmountRef.current) productAmountRef.current.value = String(item.price);
                }}
              >
                <option value="">選択しない</option>
                {productOptions.map((m) => (
                  <option key={m.id} value={m.name}>
                    {m.name}（¥{m.price.toLocaleString("ja-JP")}）
                  </option>
                ))}
              </select>
            )}
          </div>
          <div style={{ gridColumn: "span 2" }}>
            <label className="form-label">金額（円）</label>
            <input
              ref={productAmountRef}
              className="field-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              name="productAmount"
              onChange={sanitizeAmountInput}
            />
          </div>

          <div style={{ gridColumn: "span 2" }}>
            <label className="form-label">メモ（任意）</label>
            <textarea className="field-textarea" name="memo" rows={2} />
          </div>
        </div>

        <input type="hidden" name="paymentMethod" value={paymentMethod} />
        <div style={{ marginBottom: 12 }}>
          <label className="form-label">お支払い方法</label>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className={paymentMethod === "cash" ? "btn-primary" : "btn-ghost"}
              onClick={() => setPaymentMethod("cash")}
              style={{ flex: 1 }}
            >
              現金
            </button>
            <button
              type="button"
              className={paymentMethod === "credit" ? "btn-primary" : "btn-ghost"}
              onClick={() => setPaymentMethod("credit")}
              style={{ flex: 1 }}
            >
              クレジット
            </button>
          </div>
        </div>

        <button className="btn-primary" type="submit" disabled={pending}>
          {pending ? "登録中…" : "登録する"}
        </button>
      </form>
    </div>
  );
}
