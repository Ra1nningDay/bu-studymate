import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuthService, adminCookieName } from "@/src/services/admin-auth.service";

export async function requireAdmin() {
  if (!(await adminAuthService.getSession((await cookies()).get(adminCookieName)?.value))) redirect("/login");
}
