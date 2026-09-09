"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { submitOwnerLogin } from "@/app/login/actions";

export default function OwnerForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await submitOwnerLogin(email, password);
      if (result.ok) {
        router.push("/sales");
        router.refresh();
      } else {
        setError(result.reason === "locked" ? "試行回数が上限に達しました。15分後に再度お試しください。" : "IDまたはパスワードが正しくありません。");
      }
    });
  };

  return (
    <form onSubmit={onSubmit}>
      {error && <div className="auth-error">{error}</div>}
      <div style={{ marginBottom: 14 }}>
        <label className="form-label">ID</label>
        <input
          className="field-input"
          type="text"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
        />
      </div>
      <div style={{ marginBottom: 18 }}>
        <label className="form-label">パスワード</label>
        <input
          className="field-input"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </div>
      <button className="btn-primary" type="submit" disabled={pending} style={{ width: "100%" }}>
        {pending ? "ログイン中…" : "ログイン"}
      </button>
    </form>
  );
}
