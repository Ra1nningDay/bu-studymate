import { playgroundController } from "@/src/controllers/playground.controller";

export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  return playgroundController.read(request, (await context.params).sessionId);
}
