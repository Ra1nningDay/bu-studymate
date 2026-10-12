import { knowledgeAdminController } from "@/src/controllers/knowledge-admin.controller";

export const runtime = "nodejs";
export const POST = async (request: Request, context: { params: Promise<{ id: string }> }) =>
  knowledgeAdminController.check(request, (await context.params).id);
