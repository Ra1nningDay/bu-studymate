import { prisma } from "@/lib/prisma";

export type AdminRole = "admin" | "viewer";
export type AdminSession = { userId: string; email: string; roles: AdminRole[] };

const isAdminRole = (name: string): name is AdminRole => name === "admin" || name === "viewer";
const roleNames = { roles: { select: { role: { select: { name: true } } } } } as const;

export class AdminUserRepository {
  constructor(private db: Pick<typeof prisma, "user"> = prisma) {}

  async findByEmail(email: string) {
    const user = await this.db.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true, email: true, passwordHash: true, disabledAt: true, ...roleNames }
    });
    return user && { ...user, roles: user.roles.map((r) => r.role.name) };
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
