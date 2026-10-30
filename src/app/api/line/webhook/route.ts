import { lineWebhookController } from "@/src/controllers/line-webhook.controller";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return lineWebhookController.handleWebhook(request);
}
