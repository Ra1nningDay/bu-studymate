import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuthService, adminCookieName } from "@/src/services/admin-auth.service";

// Request-scoped memoization: the admin layout and page both call requireAdmin()
// during one server render, so share a single session/user lookup. React cache()
// does not persist across requests, so disabled users and role changes still
// apply on the next request. Every page must keep calling requireAdmin(): soft
// navigation does not re-render the shared layout.
const resolveAdminSession = cache((token: string | undefined) => adminAuthService.getSession(token));

export async function requireAdmin() {
  const session = await resolveAdminSession((await cookies()).get(adminCookieName)?.value);
  if (!session) redirect("/login");
  return session;
}
