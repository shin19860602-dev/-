import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import Topbar from "../Topbar";
import { createAccountant, revokeAccountant } from "./actions";
export default async function AccountantSettings({ searchParams }: { searchParams: Promise<{ error?: string; created?: string; revoked?: string }> }) {
 const session = await requireSession();
 if (session?.role !== "OWNER") redirect("/");
 const sp = await searchParams;
 const accounts = await prisma.staff.findMany({ where: { role: "ACCOUNTANT" }, select: { id: true, name: true, email: true, active: true }, orderBy: { createdAt: "asc" } });
 return <><Topbar title="税理士の閲覧設定" scopeLabel="全店舗" roleLabel="オーナー全権限" />
 <div className="view"><div className="card card-pad">
 <h2 className="card-title">税理士専用アカウント</h2>
 <p>売上・ダッシュボード・集計・毎月のスタッフ給与を閲覧できます。貯金・設定・カルテは閲覧できません。登録・編集・削除もできません。</p>
 <p>ログイン先：<a href="/login/accountant">税理士ログイン</a></p>
 {sp.error && <p role="alert">{sp.error === "duplicate" ? "このメールアドレスは登録済みです。別のアドレスをご利用ください。" : "名前・メールアドレス・12〜128文字のパスワードを入力してください。"}</p>}
 {(sp.created || sp.revoked) && <p role="status">{sp.created ? "アカウントを作成しました。ログイン情報を税理士さんにお伝えください。" : "閲覧権限を停止しました。"}</p>}
 <form action={createAccountant} style={{ display: "grid", gap: 12, maxWidth: 480 }}>
 <label>名前<input className="field-input" name="name" required maxLength={80} autoComplete="off" /></label>
 <label>メールアドレス<input className="field-input" name="email" type="email" required autoComplete="off" /></label>
 <label>初期パスワード（12文字以上）<input className="field-input" name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /></label>
 <button className="btn-primary" type="submit">閲覧専用アカウントを作成</button></form></div>
 <div className="card card-pad"><h2 className="card-title">登録済みアカウント</h2>
 {accounts.map(a=><div key={a.id} style={{ marginBottom: 16 }}><div>{a.name}・{a.email}・{a.active ? "利用中" : "停止済み"}</div>
 {a.active && <form action={revokeAccountant}><input type="hidden" name="id" value={a.id} /><button className="btn-ghost" type="submit">このアカウントの閲覧を停止</button></form>}</div>)}
 {!accounts.length && <p>まだ登録されていません。</p>}</div></div></>;
}
