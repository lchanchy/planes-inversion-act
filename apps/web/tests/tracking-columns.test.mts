import assert from "node:assert/strict";
import test from "node:test";
import { canEditTracking, resolveTrackingTarget, trackingFrozenOffsets } from "../src/lib/tracking-columns.ts";

test("limita la edición a los tres roles autorizados", () => {
  assert.equal(canEditTracking(["super_admin"]), true);
  assert.equal(canEditTracking(["project_admin"]), true);
  assert.equal(canEditTracking(["municipal_technician"]), true);
  assert.equal(canEditTracking(["coordinator", "auditor", "viewer"]), false);
});

test("inmoviliza solo familia por defecto sin reservar espacio para columnas libres", () => {
  const offsets = trackingFrozenOffsets(["familyName"]);
  assert.equal(offsets.familyName, 0);
  assert.equal(offsets.familyCode, null);
});

test("acumula anchos únicamente de las columnas seleccionadas", () => {
  const offsets = trackingFrozenOffsets(["familyCode", "familyName", "municipalityName"]);
  assert.equal(offsets.familyCode, 0);
  assert.equal(offsets.familyName, 120);
  assert.equal(offsets.municipalityName, 330);
});

test("prioriza la meta manual y conserva el valor cero", () => {
  assert.equal(resolveTrackingTarget(150, undefined, 80), 80);
  assert.equal(resolveTrackingTarget(150, 0), 0);
  assert.equal(resolveTrackingTarget(150, undefined, null), 150);
});
