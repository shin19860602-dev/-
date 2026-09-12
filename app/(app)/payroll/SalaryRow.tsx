"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSalary } from "./actions";
import { yen } from "@/lib/analytics";
import { salaryGross, salaryDeduction, salaryNet } from "@/lib/payroll";
import { calcIncomeTax } from "@/lib/incomeTax";
import { sanitizeAmountInput } from "@/lib/format";

type Props = {
  staffId: string;
  staffName: string;
  storeName: string;
  yearMonth: string;
  baseSalary: number;
  serviceCommission: number;
  productCommission: number;
  specialAllowance: number;
  employmentInsurance: number;
  incomeTax: number;
  residentTax: number;
  memo: string;
  insuranceRate: number;
  canEdit: boolean;
};

export default function SalaryRow(props: Props) {
  const { staffId, staffName, storeName, yearMonth, memo, insuranceRate, canEdit } = props;
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  const baseSalaryRef = useRef<HTMLInputElement>(null);
  const serviceCommissionRef = useRef<HTMLInputElement>(null);
  const productCommissionRef = useRef<HTMLInputElement>(null);
  const specialAllowanceRef = useRef<HTMLInputElement>(null);
  const employmentInsuranceRef = useRef<HTMLInputElement>(null);
  const incomeTaxRef = useRef<HTMLInputElement>(null);
  const residentTaxRef = useRef<HTMLInputElement>(null);
  const grossRef = useRef<HTMLInputElement>(null);
  const deductionRef = useRef<HTMLInputElement>(null);
  const netRef = useRef<HTMLInputElement>(null);
  const insuranceTouchedRef = useRef(false);
  const incomeTaxTouchedRef = useRef(false);

  const num = (ref: React.RefObject<HTMLInputElement | null>) => Number(ref.current?.value || "0") || 0;

  function updateAll() {
    const gross = num(baseSalaryRef) + num(serviceCommissionRef) + num(productCommissionRef) + num(specialAllowanceRef);

    // 雇用保険は支給合計×料率で自動提案（手入力したら以後は上書きしない）
    if (!insuranceTouchedRef.current && employmentInsuranceRef.current) {
      employmentInsuranceRef.current.value = String(Math.round((gross * insuranceRate) / 100));
    }
    const insurance = num(employmentInsuranceRef);

    // 所得税は国税庁の源泉徴収税額表（月額表・甲欄・0人）から自動提案（手入力したら以後は上書きしない）
    if (!incomeTaxTouchedRef.current && incomeTaxRef.current) {
      incomeTaxRef.current.value = String(calcIncomeTax(gross - insurance));
    }

    const deduction = insurance + num(incomeTaxRef) + num(residentTaxRef);
    if (grossRef.current) grossRef.current.value = String(gross);
    if (deductionRef.current) deductionRef.current.value = String(deduction);
    if (netRef.current) netRef.current.value = String(gross - deduction);
  }

  const gross = salaryGross(props);
  const deduction = salaryDeduction(props);
  const net = salaryNet(props);

  if (editing && canEdit) {
    return (
      <form
        className="card-pad"
        style={{ borderBottom: "1px solid var(--border)" }}
        action={(formData) => {
          setError(null);
          startSave(async () => {
            const result = await saveSalary(formData);
            if (result.ok) {
              setEditing(false);
              router.refresh();
            } else {
              setError(result.error);
            }
          });
        }}
      >
        <input type="hidden" name="staffId" value={staffId} />
        <input type="hidden" name="yearMonth" value={yearMonth} />
        <div className="card-title" style={{ marginBottom: 10 }}>
          {staffName}
          <span className="card-sub" style={{ margin: 0, marginLeft: 8, display: "inline" }}>
            {storeName}
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 10 }}>
          <div>
            <label className="form-label">基本給（円）</label>
            <input
              ref={baseSalaryRef}
              className="field-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              name="baseSalary"
              defaultValue={props.baseSalary || ""}
              onChange={(e) => {
                sanitizeAmountInput(e);
                updateAll();
              }}
            />
          </div>
          <div>
            <label className="form-label">特別手当（円・任意）</label>
            <input
              ref={specialAllowanceRef}
              className="field-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              name="specialAllowance"
              defaultValue={props.specialAllowance || ""}
              onChange={(e) => {
                sanitizeAmountInput(e);
                updateAll();
              }}
            />
          </div>

          <div>
            <label className="form-label">技術歩合手当（円・任意）</label>
            <input
              ref={serviceCommissionRef}
              className="field-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              name="serviceCommission"
              defaultValue={props.serviceCommission || ""}
              onChange={(e) => {
                sanitizeAmountInput(e);
                updateAll();
              }}
            />
          </div>
          <div>
            <label className="form-label">商品歩合手当（円・任意）</label>
            <input
              ref={productCommissionRef}
              className="field-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              name="productCommission"
              defaultValue={props.productCommission || ""}
              onChange={(e) => {
                sanitizeAmountInput(e);
                updateAll();
              }}
            />
          </div>

          <div style={{ gridColumn: "span 2" }}>
            <label className="form-label">支給合計（円・自動計算）</label>
            <input ref={grossRef} className="field-input" type="text" readOnly style={{ background: "var(--surface-muted)" }} />
          </div>

          <div style={{ gridColumn: "span 2", borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: 2 }}>
            <div className="form-label" style={{ marginBottom: 8 }}>
              控除
            </div>
          </div>
          <div>
            <label className="form-label">雇用保険（円・自動提案）</label>
            <input
              ref={employmentInsuranceRef}
              className="field-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              name="employmentInsurance"
              defaultValue={props.employmentInsurance || ""}
              onChange={(e) => {
                sanitizeAmountInput(e);
                insuranceTouchedRef.current = true;
                updateAll();
              }}
            />
          </div>
          <div>
            <label className="form-label">所得税（円・自動提案）</label>
            <input
              ref={incomeTaxRef}
              className="field-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              name="incomeTax"
              defaultValue={props.incomeTax || ""}
              onChange={(e) => {
                sanitizeAmountInput(e);
                incomeTaxTouchedRef.current = true;
                updateAll();
              }}
            />
          </div>
          <div>
            <label className="form-label">住民税（円・手入力）</label>
            <input
              ref={residentTaxRef}
              className="field-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              name="residentTax"
              defaultValue={props.residentTax || ""}
              onChange={(e) => {
                sanitizeAmountInput(e);
                updateAll();
              }}
            />
          </div>
          <div>
            <label className="form-label">控除合計（円・自動計算）</label>
            <input ref={deductionRef} className="field-input" type="text" readOnly style={{ background: "var(--surface-muted)" }} />
          </div>

          <div style={{ gridColumn: "span 2" }}>
            <label className="form-label">差引合計（円・自動計算）</label>
            <input ref={netRef} className="field-input" type="text" readOnly style={{ background: "var(--surface-muted)", fontWeight: 700 }} />
          </div>

          <div style={{ gridColumn: "span 2" }}>
            <label className="form-label">メモ（任意）</label>
            <input className="field-input" name="memo" defaultValue={memo} placeholder="備考など" />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-primary" type="submit" disabled={saving} style={{ padding: "6px 14px" }}>
            {saving ? "保存中…" : "保存"}
          </button>
          <button
            type="button"
            className="btn-ghost"
            style={{ padding: "6px 14px" }}
            disabled={saving}
            onClick={() => {
              setError(null);
              setEditing(false);
            }}
          >
            キャンセル
          </button>
        </div>
        {error && (
          <div className="auth-error" style={{ marginTop: 8 }}>
            {error}
          </div>
        )}
      </form>
    );
  }

  return (
    <div className="list-row">
      <div className="grow">
        <div className="title">
          {staffName}
          <span className="card-sub" style={{ margin: 0, marginLeft: 8, display: "inline" }}>
            {storeName}
          </span>
        </div>
        <div className="meta">
          支給合計 {yen(gross)}・控除合計 {yen(deduction)}・差引合計 <strong style={{ color: "var(--text)" }}>{yen(net)}</strong>
          {memo ? `・${memo}` : ""}
        </div>
      </div>
      {canEdit && (
        <button type="button" className="btn-ghost" style={{ padding: "5px 12px", fontSize: 11.5 }} onClick={() => setEditing(true)}>
          {gross || deduction ? "編集" : "登録"}
        </button>
      )}
    </div>
  );
}
