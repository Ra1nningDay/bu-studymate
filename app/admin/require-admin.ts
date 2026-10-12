import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuthService, adminCookieName } from "@/src/services/admin-auth.service";

export async function requireAdmin() {
  if (!adminAuthService.isAuthenticated((await cookies()).get(adminCookieName)?.value)) redirect("/login");
}
