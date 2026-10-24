import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

// Usage: tsx scripts/admin-user.ts create <email> [admin|viewer] | reset <email>
async function main() {
  const [command, email, role = "admin"] = process.argv.slice(2);
  if (!email || (command !== "create" && command !== "reset")) throw new Error("Usage: pnpm admin:create <email> [admin|viewer] | pnpm admin:reset <email>");
  const { adminUserService } = await import("../src/services/admin-user.service");
  const { password } = command === "create"
    ? await adminUserService.provision(email, role as "admin" | "viewer")
    : await adminUserService.resetPassword(email);
  console.log(password ? `Password for ${email.trim().toLowerCase()} (shown once): ${password}` : `${email} now has role ${role}; existing password unchanged.`);
}

main()
  .catch((error) => { console.error(error.message); process.exitCode = 1; })
  .finally(async () => { const { prisma } = await import("../lib/prisma"); await prisma.$disconnect(); });
