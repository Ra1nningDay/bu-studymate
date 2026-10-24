import assert from "node:assert/strict";
import { test } from "node:test";
import { hashPassword, verifyPassword } from "./password";

test("hash then verify round-trips", async () => {
  const stored = await hashPassword("correct horse");
  assert.match(stored, /^scrypt\$16384\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
  assert.equal(await verifyPassword("correct horse", stored), true);
});

test("wrong password and malformed stored value return false", async () => {
  const stored = await hashPassword("correct horse");
  assert.equal(await verifyPassword("wrong", stored), false);
  for (const bad of ["", "plaintext", "scrypt$16384$zz$yy", "scrypt$16384$00$00", "bcrypt$1$aa$bb", `${stored}$extra`]) {
    assert.equal(await verifyPassword("correct horse", bad), false);
  }
});

test("two hashes of the same password differ", async () => {
  assert.notEqual(await hashPassword("same"), await hashPassword("same"));
});
