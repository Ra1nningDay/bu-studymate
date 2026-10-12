import { requireAdmin } from "../require-admin";
import { Playground } from "./playground";

export const dynamic = "force-dynamic";
export default async function AdminChatPage() {
  await requireAdmin();
  return <Playground />;
}
