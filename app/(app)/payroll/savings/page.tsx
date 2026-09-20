import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { resolveStoreScope } from "@/lib/scope";
import { prisma } from "@/lib/prisma";
import { jstParts } from "@/lib/date";
import Topbar from "../../Topbar";
import SettingsTabs from "../../SettingsTabs";
import MonthSelect from "../../MonthSelect";
import StoreSavingsRow from "../StoreSavingsRow";
import SavingsPasswordGate from "../SavingsPasswordGate";
import SavingsPasswordForm from "../SavingsPasswordForm";

const ROLE_LABEL: Record<string, string> = { OWNER: "オーナー全権限", MANAGER: "マネージャー権限", STAFF: "スタッフ権限" };

export default async function StoreSavingsPage({ searchParams }: { searchParams: Promise<{ store?: string; month?: string }> }) {
  const session = await requireSession();
  if (!session) redirect("/");

  const canEdit = session.role === "OWNER";

  const sp = await searchParams;
  const { storeId, store } = await resolveStoreScope(session, sp.store);
  const scopeLabel = store ? store.name : "全店舗";

  // 給料閲覧用パスワードとは別の、貯金専用パスワードで解除する
  const unlocked = canEdit || session.savingsUnlockedStoreId === storeId;
  if (!unlocked) {
    return (
      <>
        <Topbar title="設定・貯金" scopeLabel={scopeLabel} roleLabel={ROLE_LABEL[session.role!]} />
        <div className="view">
          <SettingsTabs isOwner={session.role === "OWNER"} />
          <SavingsPasswordGate storeId={storeId!} />
        </div>
      </>
    );
  }

  const now = new Date();
  const nowJst = jstParts(now);
  const monthOptions: { value: string; label: string }[] = [];
  {
    let y = nowJst.year;
    let m = nowJst.month;
    for (let i = 0; i < 24; i++) {
      monthOptions.push({ value: `${y}-${String(m + 1).padStart(2, "0")}`, label: `${y}年${m + 1}月` });
      m -= 1;
      if (m < 0) {
        m = 11;
        y -= 1;
      }
    }
  }
  const defaultMonthValue = `${nowJst.year}-${String(nowJst.month + 1).padStart(2, "0")}`;
  const selectedMonthValue = sp.month && monthOptions.some((o) => o.value === sp.month) ? sp.month : defaultMonthValue;

  const stores = await prisma.store.findMany({
    where: { kind: { not: "VINTAGE" }, ...(storeId ? { id: storeId } : {}) },
    orderBy: { createdAt: "asc" },
  });
  const passwordStores = canEdit
    ? stores.map((s) => ({ id: s.id, name: s.name, savingsPassword: s.savingsPassword }))
    : [];
  const savings = await prisma.storeSavings.findMany({
    where: { storeId: { in: stores.map((s) => s.id) }, yearMonth: selectedMonthValue },
  });
  const savingsByStore = new Map(savings.map((s) => [s.storeId, s]));

  return (
    <>
      <Topbar title="設定・貯金" scopeLabel={scopeLabel} roleLabel={ROLE_LABEL[session.role!]} />
      <div className="view">
        <SettingsTabs isOwner={session.role === "OWNER"} />

        {canEdit && (
          <div className="card card-pad" style={{ marginBottom: 16 }}>
            <div className="card-title">貯金閲覧用パスワード</div>
            <div className="card-sub">スタッフ・マネージャーが自店舗の店舗貯金を見る際に入力するパスワードです（給料閲覧用パスワードとは別です）。</div>
            <div>
              {passwordStores.map((s) => (
                <SavingsPasswordForm key={s.id} storeId={s.id} storeName={s.name} isSet={!!s.savingsPassword} />
              ))}
            </div>
          </div>
        )}

        <div className="filters" style={{ marginBottom: 16 }}>
          <MonthSelect options={monthOptions} current={selectedMonthValue} />
        </div>

        <div className="card card-pad" style={{ marginTop: 0 }}>
          <div className="card-title">店舗貯金</div>
          <div className="card-sub">特定のスタッフの給料ではなく、店舗として積み立てる資金です。給料の合計には含まれません。</div>
          <div>
            {stores.map((s) => {
              const saving = savingsByStore.get(s.id);
              return (
                <StoreSavingsRow
                  key={s.id}
                  storeId={s.id}
                  storeName={s.name}
                  yearMonth={selectedMonthValue}
                  amount={saving?.amount ?? 0}
                  memo={saving?.memo ?? ""}
                  canEdit={canEdit}
                />
              );
            })}
            {stores.length === 0 && <div className="card-sub" style={{ padding: "16px 0" }}>店舗が見つかりません。</div>}
          </div>
        </div>

        <div className="card-sub" style={{ marginTop: 10 }}>
          {canEdit ? "※登録・編集できるのはオーナーのみです。" : "※閲覧のみです。"}
        </div>
      </div>
    </>
  );
}
