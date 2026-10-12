import { knowledgeCheckController } from "@/src/controllers/knowledge-check.controller";

export const runtime = "nodejs";
export const maxDuration = 300;
export async function GET(request: Request) {
  return knowledgeCheckController.check(request);
}
