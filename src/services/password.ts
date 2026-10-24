import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number, options: { N: number }) => Promise<Buffer>;

const COST = 16384;
const KEY_BYTES = 64;

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, KEY_BYTES, { N: COST });
  return `scrypt$${COST}$${salt.toString("hex")}$${key.toString("hex")}`;
}

/** Format: scrypt$<cost>$<saltHex>$<hashHex>. Returns false (never throws) for any malformed `stored`. */
export async function verifyPassword(password: string, stored: string) {
  const match = /^scrypt\$(\d+)\$([0-9a-f]{32})\$([0-9a-f]{128})$/.exec(stored);
  if (!match || Number(match[1]) !== COST) return false;
  const key = await scryptAsync(password, Buffer.from(match[2], "hex"), KEY_BYTES, { N: COST });
  return timingSafeEqual(key, Buffer.from(match[3], "hex"));
}
