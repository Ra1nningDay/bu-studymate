export type Intent =
  | "ADD_STUDY_NOTE"
  | "ASK_BU_INFO"
  | "ASK_FRESH_INFO"
  | "ASK_STUDY_MEMORY"
  | "CREATE_TICKET"
  | "CHECK_TICKET_STATUS"
  | "GENERAL_CHAT"
  | "OUT_OF_SCOPE"
  | "LIST_ASSIGNMENTS"
  | "LIST_NOTEBOOKS"
  | "VIEW_NOTEBOOK"
  | "UNKNOWN";

export function extractTicketCode(message: string) {
  return message.match(/BU-TICKET-\d{4,}/i)?.[0].toUpperCase() ?? null;
}
