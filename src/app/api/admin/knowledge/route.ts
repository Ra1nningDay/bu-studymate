import { knowledgeAdminController } from "@/src/controllers/knowledge-admin.controller";

export const runtime = "nodejs";
export const GET = (request: Request) => knowledgeAdminController.list(request);
export const POST = (request: Request) => knowledgeAdminController.save(request);
