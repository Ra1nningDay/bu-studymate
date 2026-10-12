import { adminAuthController } from "@/src/controllers/admin-auth.controller";

export const runtime = "nodejs";
export async function POST(request: Request) {
  return adminAuthController.login(request);
}
