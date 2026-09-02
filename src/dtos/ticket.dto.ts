import { z } from "zod";

export const TicketStatusEnum = z.enum(["PENDING", "IN_PROGRESS", "RESOLVED"]);
export type TicketStatusDto = z.infer<typeof TicketStatusEnum>;

export const TicketDraftSchema = z.object({
  location: z.string().trim().optional(),
  room: z.string().trim().optional(),
  description: z.string().trim().optional()
});

export type TicketDraftDto = z.infer<typeof TicketDraftSchema>;

export const UpdateTicketStatusSchema = z.object({
  status: TicketStatusEnum,
  password: z.string().optional()
});

export type UpdateTicketStatusDto = z.infer<typeof UpdateTicketStatusSchema>;

export type TicketResponseDto = {
  id: string;
  ticket_code: string;
  line_user_id: string;
  location: string | null;
  room: string | null;
  description: string;
  status: TicketStatusDto;
  created_at: string;
  updated_at: string;
};

export type ChatSessionDto = {
  id: string;
  line_user_id: string;
  state: "IDLE" | "CREATING_TICKET" | "CONFIRMING_TICKET";
  draft_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};
