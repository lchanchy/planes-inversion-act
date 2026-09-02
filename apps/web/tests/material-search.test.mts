import assert from "node:assert/strict";
import test from "node:test";
import { materialSuggestions } from "../src/lib/material-search.ts";
import type { Material } from "../src/lib/types.ts";

const catalog = Array.from({ length: 5 }, (_, index) => ({
  id: String(index), name: `Abono orgánico ${index}`, internal_code: `MAT-${index}`, unit: "kg",
  active: true, is_deleted: false, quoted_unit_price: 1200
} as Material));

test("materiales: busca nombre sin tildes, código y palabras en cualquier orden; máximo tres", () => {
  assert.equal(materialSuggestions(catalog, "ORGANICO abono").length, 3);
  assert.equal(materialSuggestions(catalog, "mat-4")[0]?.id, "4");
  assert.equal(materialSuggestions(catalog, "inexistente").length, 0);
  assert.equal(materialSuggestions(catalog, "").length, 3);
});

test("materiales: excluye inactivos y eliminados y conserva unidad y precio del catálogo", () => {
  const result = materialSuggestions([
    { ...catalog[0], active: false }, { ...catalog[1], is_deleted: true }, catalog[2]
  ], "abono");
  assert.deepEqual(result.map((item) => item.id), ["2"]);
  assert.equal(result[0].unit, "kg");
  assert.equal(result[0].quoted_unit_price, 1200);
});
