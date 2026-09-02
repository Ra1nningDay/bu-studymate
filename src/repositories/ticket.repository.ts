import { prisma } from "@/lib/prisma";

export type CreateTicketData = {
  ticketCode: string;
  lineUserId: string;
  location?: string | null;
  room?: string | null;
  description: string;
  status?: string;
};

export class TicketRepository {
  async create(data: CreateTicketData) {
    return prisma.ticket.create({
      data: {
        ticketCode: data.ticketCode,
        lineUserId: data.lineUserId,
        location: data.location,
        room: data.room,
        description: data.description,
        status: data.status ?? "IN_PROGRESS"
      }
    });
  }

  async findByCode(ticketCode: string) {
    return prisma.ticket.findUnique({
      where: { ticketCode }
    });
  }

  async findById(id: string) {
    return prisma.ticket.findUnique({
      where: { id }
    });
  }

  async updateStatus(id: string, status: string) {
    return prisma.ticket.update({
      where: { id },
      data: { status }
    });
  }

  async listRecent(limit = 100) {
    return prisma.ticket.findMany({
      orderBy: { createdAt: "desc" },
      take: limit
    });
  }

  async getRecentTicketCodes(take = 25) {
    return prisma.ticket.findMany({
      select: { ticketCode: true },
      orderBy: { createdAt: "desc" },
      take
    });
  }
}

export const ticketRepository = new TicketRepository();
