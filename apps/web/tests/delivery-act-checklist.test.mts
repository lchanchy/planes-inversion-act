import assert from "node:assert/strict";
import test from "node:test";
import { deliveryQuantityError } from "../src/lib/delivery-act-checklist.ts";

test("acepta entregas parciales y totales", () => {
  assert.equal(deliveryQuantityError(4, 10), null);
  assert.equal(deliveryQuantityError(10, 10), null);
});

test("rechaza cero, valores inválidos y sobreentregas", () => {
  assert.ok(deliveryQuantityError(0, 10));
  assert.ok(deliveryQuantityError(Number.NaN, 10));
  assert.ok(deliveryQuantityError(10.01, 10));
});
