import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("el botón, formulario y listado de contrapartidas comparten el cuadro de cada actividad", () => {
  const source = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  const start = source.indexOf('<section className="panel" aria-label={`Contrapartida familiar de');
  assert.ok(start >= 0);
  const section = source.slice(start, source.indexOf("</section>", start));
  assert.ok(section.includes("Agregar contrapartida"));
  assert.ok(section.includes("counterpartForm.plan_activity_id === planActivity.id"));
  assert.ok(section.includes("onSubmit={savePlanCounterpart}"));
  assert.ok(section.includes("rows={counterpartsForActivity.map"));
  assert.ok(section.includes('clearPlanForms("counterpart")'));
  assert.ok(section.includes("disabled={!canEditPlan}"));
  assert.ok(!section.includes("onSubmit={savePlanMaterial}"));
});
