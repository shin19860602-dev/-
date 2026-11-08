export function paymentTotals(visits: { amount: number; productAmount?: number | null; paymentMethod?: string | null }[]) {
  return visits.reduce((totals, visit) => {
    const amount = visit.amount + (visit.productAmount ?? 0);
    if (visit.paymentMethod === "cash") totals.cash += amount;
    else if (visit.paymentMethod === "credit") totals.credit += amount;
    else totals.unknown += amount;
    return totals;
  }, { cash: 0, credit: 0, unknown: 0 });
}
