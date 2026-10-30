import { knowledgeAdminController } from "@/src/controllers/knowledge-admin.controller";

export const runtime = "nodejs";
export const GET = async (request: Request, context: { params: Promise<{ id: string }> }) =>
  knowledgeAdminController.read(request, (await context.params).id);
