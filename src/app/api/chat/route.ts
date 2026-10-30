import { chatController } from "@/src/controllers/chat.controller";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return chatController.handleWebChat(request);
}
