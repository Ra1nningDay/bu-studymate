import { redirect } from "next/navigation";

export default function LegacyChatPage() {
  redirect("/admin/chat");
}
