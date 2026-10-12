import { playgroundController } from "@/src/controllers/playground.controller";

export const runtime = "nodejs";
export async function POST(request: Request) {
  return playgroundController.send(request);
}
