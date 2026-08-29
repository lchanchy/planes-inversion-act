import assert from "node:assert/strict";
import test from "node:test";
import { annualHouseholdIncome } from "../src/lib/economia-income.ts";

test("conserva el ingreso anual real del producto y anualiza solo ingresos mensuales", () => {
  assert.equal(annualHouseholdIncome(100_001, 10_000, 5_000), 280_001);
});
