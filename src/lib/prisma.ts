import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

// Query through node-postgres (driver adapter) instead of Prisma's engine
// connection. With Supabase's transaction pooler (port 6543) the engine needs
// `pgbouncer=true`, which measured ~5 network round-trips per query; node-postgres
// sends unnamed statements in one round-trip and stays pooler-safe
// (see .scratch/admin-perf/issues/07-pg-driver-adapter.md).
// `pgbouncer` is a Prisma-only URL flag; strip it so it is not forwarded to the
// server. The URL stays compatible with the Prisma CLI, which uses DIRECT_URL.
// This SDK client reads process.env directly (as before) because importing the
// validated env here would make prisma-mocking unit tests require a full environment.
export function adapterConnectionString(url: string | undefined) {
  if (!url) return url;
  return url.replace(/([?&])pgbouncer=[^&]*(&|$)/, (_, lead: string, tail: string) => (tail ? lead : "")).replace(/[?&]$/, "");
}

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: adapterConnectionString(process.env.DATABASE_URL), max: 5 });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
