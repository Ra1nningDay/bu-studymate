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

export class StudentAccountRepository {
  constructor(
    private db: Pick<typeof prisma, "$transaction" | "studentAccount" | "botRun" | "ticket"> = prisma
  ) {}

  async list({ q, limit = 200 }: { q?: string; limit?: number } = {}): Promise<StudentRow[]> {
    const email = q?.trim();
    const accounts = await this.db.studentAccount.findMany({
      where: email ? { email: { contains: email, mode: "insensitive" } } : undefined,
      orderBy: { verifiedAt: "desc" },
      take: limit,
      select: { lineUserId: true, email: true, verifiedAt: true }
    });
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
      const byLine = await tx.studentAccount.findUnique({ where: { lineUserId } });
      if (byLine) return byLine.email === email ? "unchanged" : "line_taken";
      if (await tx.studentAccount.findUnique({ where: { email } })) return "email_taken";
      await tx.studentAccount.create({ data: { lineUserId, email } });
      return "bound";
    });
  }

  /** Unbinds the student (deletes only the account row); the typed email must match so a stale or forged id cannot delete the wrong person. */
  async remove({ lineUserId, confirmEmail }: { lineUserId: string; confirmEmail: string }): Promise<"deleted" | "mismatch" | "not_found"> {
    const account = await this.db.studentAccount.findUnique({ where: { lineUserId }, select: { email: true } });
    if (!account) return "not_found";
    if (account.email.toLowerCase() !== confirmEmail.trim().toLowerCase()) return "mismatch";
    await this.db.studentAccount.delete({ where: { lineUserId } });
    return "deleted";
  }

  findByLineUserId(lineUserId: string) {
    return this.db.studentAccount.findUnique({
      where: { lineUserId },
      select: { lineUserId: true, email: true }
    });
  }
}

export const studentAccountRepository = new StudentAccountRepository();
