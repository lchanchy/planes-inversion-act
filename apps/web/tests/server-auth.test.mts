import assert from "node:assert/strict";
import test from "node:test";
import { bearerToken } from "../src/lib/server-auth.ts";

test("acepta solamente un encabezado Bearer con token", () => {
  assert.equal(bearerToken("Bearer token-valido"), "token-valido");
  assert.equal(bearerToken("bearer   token-valido  "), "token-valido");
  assert.equal(bearerToken("Basic credenciales"), null);
  assert.equal(bearerToken(null), null);
});
