import assert from "node:assert/strict";
import test from "node:test";
import { fetchAllPages } from "../src/lib/supabase-pagination.ts";

test("pagina hasta recibir una pagina incompleta", async () => {
  const source = Array.from({ length: 1_205 }, (_, id) => ({ id }));
  const calls: Array<[number, number]> = [];
  const result = await fetchAllPages(async (from, to) => {
    calls.push([from, to]);
    return { data: source.slice(from, to + 1), error: null };
  }, 500);

  assert.equal(result.error, null);
  assert.equal(result.data?.length, 1_205);
  assert.deepEqual(calls, [[0, 499], [500, 999], [1_000, 1_499]]);
});
