import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "../require-admin";
import { listBotRunReviews, type BotRunReviewFilters } from "@/lib/bot-run-review";
import { RunsWorkspace } from "./runs-workspace";
import { analyticsDateRange } from "@/lib/analytics-date-range";
import { DateRangeFilter } from "../date-range-filter";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function asString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function RunsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const params = await searchParams;
  if (params.password !== undefined) redirect("/admin/runs");
  const range = analyticsDateRange(params);
  const serverFilters = {
    channel: asString(params.channel),
    intent: asString(params.intent),
    status: asString(params.status),
    target: asString(params.target),
    usedWebSearch: asString(params.usedWebSearch)
  };
  const filters: BotRunReviewFilters = { from: range.from, to: range.to, ...serverFilters };
  const dateFilter = <DateRangeFilter {...range} action="/admin/runs" preservedFilters={serverFilters} />;
  if (range.error) return <main className="space-y-4"><h1 className="text-2xl font-semibold">Bot Runs</h1>{dateFilter}<p role="alert">{range.error}</p></main>;
  const requestedPage = Number(asString(params.page));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const limit = 12;

  let data: Awaited<ReturnType<typeof listBotRunReviews>>;
  try {
    data = await listBotRunReviews(filters, page, limit);
  } catch {
    return (
      <main className="rounded-lg border border-amber-200 bg-white p-6">
        <h1 className="text-2xl font-bold">Bot Runs</h1>
        <div className="mt-4">{dateFilter}</div>
        <p role="alert" className="mt-4 text-sm text-amber-800">Unable to load bot runs. Check the database connection and schema, then refresh.</p>
        <Link href="/admin/runs" className="mt-4 inline-block text-sm font-semibold text-emerald-700 underline">Try again</Link>
      </main>
    );
  }

  return <RunsWorkspace key={JSON.stringify([filters, page, asString(params.run), asString(params.view)])} {...data} filters={filters} today={range.today} page={page} limit={limit} initialRunId={asString(params.run)} initialView={asString(params.view)} />;
}
