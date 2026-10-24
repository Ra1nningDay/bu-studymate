import type { ReactNode } from "react";
import { requireAdmin } from "./require-admin";
import { AdminShell } from "./admin-shell";

export const dynamic = "force-dynamic";
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await requireAdmin();
  return <AdminShell user={{ email: session.email, role: session.roles.includes("admin") ? "admin" : "viewer" }}>{children}</AdminShell>;
}
