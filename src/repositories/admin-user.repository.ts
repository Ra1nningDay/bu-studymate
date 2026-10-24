import { prisma } from "@/lib/prisma";

export type AdminRole = "admin" | "viewer";
export type AdminSession = { userId: string; email: string; roles: AdminRole[] };

const isAdminRole = (name: string): name is AdminRole => name === "admin" || name === "viewer";
const roleNames = { roles: { select: { role: { select: { name: true } } } } } as const;

export class AdminUserRepository {
  constructor(private db: Pick<typeof prisma, "$transaction" | "user"> = prisma) {}

  async findByEmail(email: string) {
    const user = await this.db.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true, email: true, passwordHash: true, disabledAt: true, ...roleNames }
    });
    return user && { ...user, roles: user.roles.map((r) => r.role.name) };
  }

  /** Creates the user if needed and grants `role`; `passwordHash` is applied only to a user that has none. */
  async upsertWithRole(email: string, role: AdminRole, passwordHash: string | null) {
    await this.db.$transaction(async (tx) => {
      const found = await tx.role.findUnique({ where: { name: role } });
      if (!found) throw new Error(`Role ${role} is missing; run migrations`);
      const user = await tx.user.upsert({ where: { email }, create: { email, passwordHash }, update: {} });
      if (passwordHash && !user.passwordHash) await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
      await tx.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: found.id } },
        create: { userId: user.id, roleId: found.id },
        update: {}
      });
    });
  }

  async setPasswordHash(email: string, passwordHash: string) {
    await this.db.user.update({ where: { email }, data: { passwordHash } });
  }

  /** Null when the user is missing, disabled, or holds neither admin nor viewer. */
  async findActiveById(id: string): Promise<AdminSession | null> {
    const user = await this.db.user.findFirst({
      where: { id, disabledAt: null },
      select: { id: true, email: true, ...roleNames }
    });
    const roles = user?.roles.map((r) => r.role.name).filter(isAdminRole) ?? [];
    return user && roles.length ? { userId: user.id, email: user.email, roles } : null;
  }
}

export const adminUserRepository = new AdminUserRepository();
