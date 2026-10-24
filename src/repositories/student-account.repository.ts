import { prisma } from "@/lib/prisma";

export type BindResult = "bound" | "unchanged" | "line_taken" | "email_taken";

export type StudentRow = {
  lineUserId: string;
  email: string;
  verifiedAt: Date;
  runs: number;
  tickets: number;
  lastActiveAt: Date | null;
};

const studentRole = { roles: { some: { role: { name: "student" } } } };

export class StudentAccountRepository {
  constructor(
    private db: Pick<typeof prisma, "$transaction" | "user" | "role" | "userRole" | "botRun" | "ticket"> = prisma
  ) {}

  async list({ q, limit = 200 }: { q?: string; limit?: number } = {}): Promise<StudentRow[]> {
    const email = q?.trim();
    const users = await this.db.user.findMany({
      where: { lineUserId: { not: null }, ...studentRole, ...(email ? { email: { contains: email, mode: "insensitive" } } : {}) },
      orderBy: { verifiedAt: "desc" },
      take: limit,
      select: { lineUserId: true, email: true, verifiedAt: true }
    });
    const accounts = users.flatMap((u) =>
      u.lineUserId && u.verifiedAt ? [{ lineUserId: u.lineUserId, email: u.email, verifiedAt: u.verifiedAt }] : []
    );
    if (accounts.length === 0) return [];
    const where = { lineUserId: { in: accounts.map((a) => a.lineUserId) } };
    const [runs, tickets] = await Promise.all([
      this.db.botRun.groupBy({ by: ["lineUserId"], where, _count: { _all: true }, _max: { createdAt: true } }),
      this.db.ticket.groupBy({ by: ["lineUserId"], where, _count: { _all: true } })
    ]);
    const runBy = new Map(runs.map((r) => [r.lineUserId, r]));
    const ticketBy = new Map(tickets.map((t) => [t.lineUserId, t._count._all]));
    return accounts.map((a) => ({
      ...a,
      runs: runBy.get(a.lineUserId)?._count._all ?? 0,
      tickets: ticketBy.get(a.lineUserId) ?? 0,
      lastActiveAt: runBy.get(a.lineUserId)?._max.createdAt ?? null
    }));
  }

  async bind({ lineUserId, email }: { lineUserId: string; email: string }): Promise<BindResult> {
    return this.db.$transaction(async (tx) => {
      const byLine = await tx.user.findUnique({ where: { lineUserId } });
      if (byLine) return byLine.email === email ? "unchanged" : "line_taken";
      const byEmail = await tx.user.findUnique({ where: { email } });
      if (byEmail?.lineUserId) return "email_taken";
      const role = await tx.role.findUnique({ where: { name: "student" } });
      if (!role) throw new Error("Role student is missing; run migrations");
      if (byEmail) {
        // An existing admin or previously unlinked student: attach LINE and student only, never another role.
        await tx.user.update({ where: { id: byEmail.id }, data: { lineUserId, verifiedAt: new Date() } });
        await tx.userRole.upsert({
          where: { userId_roleId: { userId: byEmail.id, roleId: role.id } },
          create: { userId: byEmail.id, roleId: role.id },
          update: {}
        });
      } else {
        await tx.user.create({ data: { email, lineUserId, verifiedAt: new Date(), roles: { create: { roleId: role.id } } } });
      }
      return "bound";
    });
  }

  /** Unlinks LINE and the student role (the user row stays, e.g. an admin); the typed email must match so a stale or forged id cannot unlink the wrong person. */
  async remove({ lineUserId, confirmEmail }: { lineUserId: string; confirmEmail: string }): Promise<"deleted" | "mismatch" | "not_found"> {
    return this.db.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { lineUserId }, select: { id: true, email: true } });
      if (!user) return "not_found";
      if (user.email.toLowerCase() !== confirmEmail.trim().toLowerCase()) return "mismatch";
      await tx.user.update({ where: { id: user.id }, data: { lineUserId: null, verifiedAt: null } });
      await tx.userRole.deleteMany({ where: { userId: user.id, role: { name: "student" } } });
      return "deleted";
    });
  }

  async findByLineUserId(lineUserId: string) {
    const user = await this.db.user.findFirst({
      where: { lineUserId, disabledAt: null, ...studentRole },
      select: { email: true }
    });
    return user ? { lineUserId, email: user.email } : null;
  }
}

export const studentAccountRepository = new StudentAccountRepository();
