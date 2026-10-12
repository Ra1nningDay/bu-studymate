import { playgroundController } from "@/src/controllers/playground.controller";

export const runtime = "nodejs";
export async function GET(request: Request) {
  return playgroundController.list(request);
}
