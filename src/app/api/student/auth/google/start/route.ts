import { studentAuthController } from "@/src/controllers/student-auth.controller";

export const runtime = "nodejs";
export async function GET(request: Request) {
  return studentAuthController.start(request);
}
