// Runs `prisma migrate deploy` only for Vercel production builds; previews and local builds skip it.
import { spawnSync } from "node:child_process";

if (process.env.VERCEL_ENV !== "production") {
  console.log(`Skipping migrate deploy (VERCEL_ENV=${process.env.VERCEL_ENV ?? "unset"}).`);
  process.exit(0);
}

const result = spawnSync("pnpm", ["db:migrate:deploy"], {
  stdio: "inherit",
  shell: process.platform === "win32"
});
process.exit(result.status ?? 1);
