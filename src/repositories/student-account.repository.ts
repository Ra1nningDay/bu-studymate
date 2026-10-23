import { prisma } from "@/lib/prisma";

export type BindResult = "bound" | "unchanged" | "line_taken" | "email_taken";

export class StudentAccountRepository {
  constructor(private db: Pick<typeof prisma, "$transaction" | "studentAccount"> = prisma) {}

  async bind({ lineUserId, email }: { lineUserId: string; email: string }): Promise<BindResult> {
    return this.db.$transaction(async (tx) => {
      const byLine = await tx.studentAccount.findUnique({ where: { lineUserId } });
      if (byLine) return byLine.email === email ? "unchanged" : "line_taken";
      if (await tx.studentAccount.findUnique({ where: { email } })) return "email_taken";
      await tx.studentAccount.create({ data: { lineUserId, email } });
      return "bound";
    });
  }

  findByLineUserId(lineUserId: string) {
    return this.db.studentAccount.findUnique({
      where: { lineUserId },
      select: { lineUserId: true, email: true }
    });
  }
}

export const studentAccountRepository = new StudentAccountRepository();
