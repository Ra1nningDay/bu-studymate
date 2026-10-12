import { redirect } from "next/navigation";
import { requireAdmin } from "../require-admin";
import { listBotRunReviews, type BotRunReviewFilters } from "@/lib/bot-run-review";
import { RunsWorkspace } from "./runs-workspace";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function asString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function RunsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const params = await searchParams;
  if (params.password !== undefined) redirect("/admin/runs");

  const filters: BotRunReviewFilters = {
    channel: asString(params.channel),
    intent: asString(params.intent),
    status: asString(params.status),
    target: asString(params.target),
    usedWebSearch: asString(params.usedWebSearch)
  };
  const requestedPage = Number(asString(params.page));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const limit = 12;

  let data: Awaited<ReturnType<typeof listBotRunReviews>>;
  try {
    data = await listBotRunReviews(filters, page, limit);
  } catch {
    return (
      <main className="rounded-lg border border-amber-200 bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">BU StudyMate</p>
        <h1 className="mt-2 text-2xl font-bold">Bot Runs</h1>
        <p role="alert" className="mt-4 text-sm text-amber-800">Unable to load bot runs. Check the database connection and schema, then refresh.</p>
        <a href="/admin/runs" className="mt-4 inline-block text-sm font-semibold text-emerald-700 underline">Try again</a>
      </main>
    );
  }

  return <RunsWorkspace key={JSON.stringify([filters, page, asString(params.run)])} {...data} filters={filters} page={page} limit={limit} initialRunId={asString(params.run)} />;
}
