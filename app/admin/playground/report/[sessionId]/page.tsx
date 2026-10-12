import { redirect, notFound } from "next/navigation";
import { PlaygroundSessionIdSchema } from "@/src/dtos/playground.dto";

export default async function LegacyReportPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  if (!PlaygroundSessionIdSchema.safeParse(sessionId).success) notFound();
  redirect(`/admin/chat/report/${sessionId}`);
}
