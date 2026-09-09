"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { submitPin } from "@/app/login/actions";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

export default function PinPad({ storeId }: { storeId: string }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (pin.length !== 4 || submittedRef.current) return;
    submittedRef.current = true;
    startTransition(async () => {
      const result = await submitPin(storeId, pin);
      if (result.ok) {
        router.push("/sales");
        router.refresh();
      } else {
        setPin("");
        submittedRef.current = false;
        setError(result.reason === "locked" ? "試行回数が上限に達しました。15分後に再度お試しください。" : "PINが正しくありません。");
        inputRef.current?.focus();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  const press = (key: string) => {
    if (pending) return;
    setError(null);
    if (key === "⌫") {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (key === "" || pin.length >= 4) return;
    setPin((p) => p + key);
  };

  return (
    <div>
      {error && <div className="auth-error">{error}</div>}
      {/* ネイティブの数字キーボードでも確実に入力できるよう、実体はここに置き、ドット表示はその上に重ねる */}
      <div className="pin-dots-wrap" onClick={() => inputRef.current?.focus()}>
        <input
          ref={inputRef}
          className="pin-native-input"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={4}
          value={pin}
          disabled={pending}
          onChange={(e) => {
            setError(null);
            setPin(e.target.value.replace(/\D/g, "").slice(0, 4));
          }}
        />
        <div className="pin-dots">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`pin-dot${i < pin.length ? " filled" : ""}`} />
          ))}
        </div>
      </div>
      <div className="pin-keypad">
        {KEYS.map((k, i) =>
          k === "" ? (
            <span key={i} />
          ) : (
            <button key={i} type="button" className="pin-key" onClick={() => press(k)} disabled={pending}>
              {k}
            </button>
          )
        )}
      </div>
    </div>
  );
}
