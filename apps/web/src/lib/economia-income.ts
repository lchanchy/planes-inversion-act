export function annualHouseholdIncome(productAnnual: number, governmentMonthly: number, otherMonthly: number): number {
  return productAnnual + (governmentMonthly + otherMonthly) * 12;
}
