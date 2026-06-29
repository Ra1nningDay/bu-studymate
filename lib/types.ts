export type KnowledgeItem = {
  id: string;
  title: string;
  category: string;
  content: string;
  keywords: string[];
  source: string | null;
  created_at: string;
  updated_at: string;
};

export type TicketStatus = "PENDING" | "IN_PROGRESS" | "RESOLVED";

export type Ticket = {
  id: string;
  ticket_code: string;
  line_user_id: string;
  location: string | null;
  room: string | null;
  description: string;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
};

export type ChatSession = {
  id: string;
  line_user_id: string;
  state: "IDLE" | "CREATING_TICKET";
  draft_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};
