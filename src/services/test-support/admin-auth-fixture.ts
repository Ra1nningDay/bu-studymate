import { hashPassword, verifyPassword } from "@/src/services/password";

process.env.DATABASE_URL ??= "postgresql://fixture:fixture@localhost:5432/fixture_unused";

export const fixtureSecret = "fixture-admin-secret-0123456789abcdef0123";

export type FixtureUser = {
  id: string;
  email: string;
  passwordHash: string | null;
  disabledAt: Date | null;
  roles: string[];
};

type Seed = { email: string; password?: string; roles: string[]; disabledAt?: Date };

/** In-memory stand-in for AdminUserRepository, mirroring its role filtering. */
export function fakeAdminUsers(users: FixtureUser[]) {
  return {
    findByEmail: async (email: string) => users.find((u) => u.email === email.trim().toLowerCase()) ?? null,
    findActiveById: async (id: string) => {
      const user = users.find((u) => u.id === id);
      const roles = user?.roles.filter((r): r is "admin" | "viewer" => r === "admin" || r === "viewer") ?? [];
      return user && !user.disabledAt && roles.length ? { userId: user.id, email: user.email, roles } : null;
    }
  };
}

export async function adminAuthFixture(...seeds: Seed[]) {
  const { AdminAuthService } = await import("@/src/services/admin-auth.service");
  const users: FixtureUser[] = [];
  for (const [i, seed] of seeds.entries()) {
    users.push({
      id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
      email: seed.email,
      passwordHash: seed.password ? await hashPassword(seed.password) : null,
      disabledAt: seed.disabledAt ?? null,
      roles: seed.roles
    });
  }
  let verifies = 0;
  const verify = (password: string, stored: string) => (verifies++, verifyPassword(password, stored));
  const repo = fakeAdminUsers(users);
  const service = new AdminAuthService(fixtureSecret, repo, verify);
  /** Logs in through the service and returns the token. */
  const tokenFor = async (email: string, password: string, now?: number) => {
    const token = await service.login(email, password, now);
    if (!token) throw new Error(`fixture login failed for ${email}`);
    return token;
  };
  const requestWith = (token?: string, init: RequestInit = {}) =>
    new Request("http://localhost:3025/api/admin/x", {
      ...init,
      headers: { ...(token ? { cookie: `studymate-admin=${token}` } : {}), ...(init.headers as Record<string, string>) }
    });
  return { service, repo, users, tokenFor, requestWith, verifies: () => verifies, AdminAuthService };
}
