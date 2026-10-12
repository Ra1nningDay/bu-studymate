import { redirect } from "next/navigation";

export default function LegacyPlaygroundPage() {
  redirect("/admin/chat");
}
