import { knowledgeAdminController } from "@/src/controllers/knowledge-admin.controller";

export const runtime = "nodejs";
export const POST = (request: Request) => knowledgeAdminController.snapshot(request);
