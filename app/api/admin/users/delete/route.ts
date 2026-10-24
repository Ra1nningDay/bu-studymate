import { studentAdminController } from "@/src/controllers/student-admin.controller";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return studentAdminController.handleDelete(request);
}
