"use client";

import { logout } from "@/app/login/actions";

export default function LogoutButton() {
  return (
    <button type="button" className="logout-btn" onClick={() => logout()}>
      ログアウト
    </button>
  );
}
