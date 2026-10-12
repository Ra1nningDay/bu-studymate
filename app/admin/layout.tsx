import type { ReactNode } from "react";
import { requireAdmin } from "./require-admin";
import { AdminShell } from "./admin-shell";

export const dynamic = "force-dynamic";
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  return <AdminShell>{children}</AdminShell>;
}
