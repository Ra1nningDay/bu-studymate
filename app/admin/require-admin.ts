import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuthService, adminCookieName } from "@/src/services/admin-auth.service";

export async function requireAdmin() {
  const session = await adminAuthService.getSession((await cookies()).get(adminCookieName)?.value);
  if (!session) redirect("/login");
  return session;
}
