// 給料の支給合計・控除合計・差引合計はここでのみ計算し、DBには内訳のみ保存する（保存後に食い違いが起きないようにするため）

export type SalaryPayments = {
  baseSalary: number;
  serviceCommission: number;
  productCommission: number;
  specialAllowance: number;
};

export type SalaryDeductions = {
  employmentInsurance: number;
  incomeTax: number;
  residentTax: number;
};

export function salaryGross(s: SalaryPayments): number {
  return s.baseSalary + s.serviceCommission + s.productCommission + s.specialAllowance;
}

export function salaryDeduction(s: SalaryDeductions): number {
  return s.employmentInsurance + s.incomeTax + s.residentTax;
}

export function salaryNet(s: SalaryPayments & SalaryDeductions): number {
  return salaryGross(s) - salaryDeduction(s);
}
