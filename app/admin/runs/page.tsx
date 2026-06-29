import Link from "next/link";
import {
  listBotRunReviews,
  type BotRunReviewFilters,
  type BotRunReviewItem
} from "@/lib/bot-run-review";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

const intentOptions = [
  "ASK_BU_INFO",
  "ASK_FRESH_INFO",
  "ASK_STUDY_MEMORY",
  "LIST_ASSIGNMENTS",
  "CREATE_TICKET",
  "CHECK_TICKET_STATUS",
  "GENERAL_CHAT",
  "UNKNOWN",
  "ADD_STUDY_NOTE"
];

const targetOptions = [
  "knowledge_base",
  "web_search",
  "study_memory",
  "ticket",
  "general_chat",
  "unknown"
];

function asString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isAdminAllowed(searchParams: SearchParams) {
  if (!process.env.ADMIN_PASSWORD) {
    return true;
  }
  return asString(searchParams.password) === process.env.ADMIN_PASSWORD;
}

function getFilters(searchParams: SearchParams): BotRunReviewFilters {
  return {
    channel: asString(searchParams.channel),
    intent: asString(searchParams.intent),
    status: asString(searchParams.status),
    target: asString(searchParams.target),
    usedWebSearch: asString(searchParams.usedWebSearch)
  };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok"
  }).format(new Date(value));
}

function truncateMiddle(value: string, maxLength = 28) {
  if (value.length <= maxLength) {
    return value;
  }

  const edge = Math.floor((maxLength - 3) / 2);
  return `${value.slice(0, edge)}...${value.slice(-edge)}`;
}

function LoginForm() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f7fb] px-6">
      <form
        method="GET"
        className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h1 className="text-xl font-semibold text-bu-ink">BU StudyMate Admin</h1>
        <p className="mt-2 text-sm text-slate-600">
          Enter the admin password to review bot runs.
        </p>
        <label className="mt-5 block text-sm font-medium text-slate-700">
          Password
          <input
            name="password"
            type="password"
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-bu-purple focus:ring-2 focus:ring-bu-purple/15"
            autoComplete="current-password"
          />
        </label>
        <button className="mt-5 w-full rounded-md bg-bu-purple px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#3a0f70]">
          Open review
        </button>
      </form>
    </main>
  );
}

function SetupNotice({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f7fb] px-6">
      <div className="w-full max-w-2xl rounded-lg border border-amber-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-bu-purple">
          BU StudyMate
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-bu-ink">
          Run review needs database setup
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Add <code>DATABASE_URL</code> and <code>DIRECT_URL</code> in{" "}
          <code>.env.local</code>, run the database schema, then restart the dev
          server.
        </p>
        <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 font-mono text-xs text-amber-800">
          {message}
        </p>
      </div>
    </main>
  );
}

function Badge({
  children,
  tone = "slate"
}: {
  children: React.ReactNode;
  tone?: "amber" | "cyan" | "emerald" | "rose" | "slate" | "violet";
}) {
  const classes = {
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    cyan: "bg-cyan-50 text-cyan-700 ring-cyan-200",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    rose: "bg-rose-50 text-rose-700 ring-rose-200",
    slate: "bg-slate-50 text-slate-700 ring-slate-200",
    violet: "bg-violet-50 text-violet-700 ring-violet-200"
  };

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${classes[tone]}`}
    >
      {children}
    </span>
  );
}

function statusTone(status: string) {
  if (status === "success") return "emerald";
  if (status === "error") return "rose";
  return "amber";
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-bu-ink">{value}</p>
    </div>
  );
}

function SelectFilter({
  label,
  name,
  options,
  value
}: {
  label: string;
  name: string;
  options: string[];
  value?: string | null;
}) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
      {label}
      <select
        name={name}
        defaultValue={value ?? "all"}
        className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-700 outline-none transition focus:border-bu-purple focus:ring-2 focus:ring-bu-purple/15"
      >
        <option value="all">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function FilterBar({
  filters,
  password
}: {
  filters: BotRunReviewFilters;
  password?: string;
}) {
  return (
    <form
      method="GET"
      className="mt-6 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-6"
    >
      {password ? <input type="hidden" name="password" value={password} /> : null}
      <SelectFilter
        label="Intent"
        name="intent"
        options={intentOptions}
        value={filters.intent}
      />
      <SelectFilter
        label="Target"
        name="target"
        options={targetOptions}
        value={filters.target}
      />
      <SelectFilter
        label="Status"
        name="status"
        options={["success", "error", "processing"]}
        value={filters.status}
      />
      <SelectFilter
        label="Channel"
        name="channel"
        options={["line", "web"]}
        value={filters.channel}
      />
      <SelectFilter
        label="Web search"
        name="usedWebSearch"
        options={["true", "false"]}
        value={filters.usedWebSearch}
      />
      <div className="flex items-end gap-2">
        <button className="h-10 flex-1 rounded-md bg-bu-purple px-4 text-sm font-semibold text-white transition hover:bg-[#3a0f70]">
          Apply
        </button>
        <Link
          href={password ? `/admin/runs?password=${encodeURIComponent(password)}` : "/admin/runs"}
          className="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition hover:border-bu-purple/40 hover:text-bu-purple"
        >
          Reset
        </Link>
      </div>
    </form>
  );
}

function RunCard({ item }: { item: BotRunReviewItem }) {
  const confidence = item.metadata.routerConfidence;
  const sourceUrls = item.assistantMessage?.sourceUrls ?? [];

  return (
    <details className="group rounded-lg border border-slate-200 bg-white shadow-sm open:pb-1">
      <summary className="cursor-pointer list-none border-b border-slate-100 transition-colors hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
        <div className="flex flex-col gap-3 px-4 pt-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-1 text-slate-400 transition-transform duration-200 group-open:rotate-90">
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
                <path d="M5.5 3.5L11 8l-5.5 4.5v-9z" />
              </svg>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={statusTone(item.status)}>{item.status}</Badge>
                <Badge tone="violet">{item.intent ?? "NO_INTENT"}</Badge>
                <Badge tone={item.usedWebSearch ? "cyan" : "slate"}>
                  {item.metadata.selectedTarget ?? "unknown"}
                </Badge>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <Badge tone={item.usedOpenAI ? "emerald" : "slate"}>
              OpenAI {item.usedOpenAI ? "yes" : "no"}
            </Badge>
            <Badge tone={item.usedWebSearch ? "cyan" : "slate"}>
              Web {item.usedWebSearch ? "yes" : "no"}
            </Badge>
            <Badge tone={item.usedStudyMemory ? "amber" : "slate"}>
              Memory {item.usedStudyMemory ? "yes" : "no"}
            </Badge>
            <Badge tone={item.usedTicketFlow ? "violet" : "slate"}>
              Ticket {item.usedTicketFlow ? "yes" : "no"}
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 px-4 pb-4 pt-3 text-xs text-slate-500">
          <div>
            <span className="font-semibold text-slate-600">Model:</span> {item.modelName || "-"}
          </div>
          <div>
            <span className="font-semibold text-slate-600">Tokens:</span> {item.tokensUsed ? item.tokensUsed.toLocaleString() : "-"}
          </div>
          <div>
            <span className="font-semibold text-slate-600">Latency:</span> {item.latencyMs ?? "-"} ms
          </div>
          <div>
            <span className="font-semibold text-slate-600">User:</span> {truncateMiddle(item.lineUserId)}
          </div>
          <div>
            <span className="font-semibold text-slate-600">Channel:</span> {item.metadata.channel ?? "unknown"}
          </div>
          <div>
            <span className="font-semibold text-slate-600">Time:</span> {formatDate(item.createdAt)}
          </div>
        </div>
      </summary>

      <div className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_320px]">
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            User message
          </h2>
          <p className="mt-2 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm leading-6 text-bu-ink">
            {item.userMessage?.content ?? "No user message linked"}
          </p>
        </section>

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Bot reply
          </h2>
          <p className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm leading-6 text-bu-ink">
            {item.assistantMessage?.content ?? item.errorCode ?? "No reply linked yet"}
          </p>
          {sourceUrls.length > 0 ? (
            <div className="mt-3 space-y-1">
              {sourceUrls.map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate text-xs font-medium text-bu-purple underline-offset-2 hover:underline"
                >
                  {url}
                </a>
              ))}
            </div>
          ) : null}
        </section>

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Router decision
          </h2>
          <dl className="mt-2 space-y-2 rounded-md bg-slate-50 p-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Type</dt>
              <dd className="font-medium text-slate-800">
                {item.metadata.routerType ?? "-"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Confidence</dt>
              <dd className="font-medium text-slate-800">
                {confidence === null ? "-" : confidence.toFixed(2)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Needs web</dt>
              <dd className="font-medium text-slate-800">
                {item.metadata.needsWebSearch === null
                  ? "-"
                  : item.metadata.needsWebSearch
                    ? "yes"
                    : "no"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Reason</dt>
              <dd className="mt-1 leading-5 text-slate-800">
                {item.metadata.routerReason ?? "-"}
              </dd>
            </div>
          </dl>
          
          {item.metadata.executionLog && Array.isArray(item.metadata.executionLog) && item.metadata.executionLog.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                Execution Details
              </h3>
              <div className="rounded-md border border-slate-200 bg-white">
                <ul className="divide-y divide-slate-100">
                  {item.metadata.executionLog.map((log: any, idx: number) => (
                    <li key={idx} className="px-3 py-2 text-xs">
                      <span className="font-medium text-bu-ink">{log.action}</span>
                      {log.details && (
                        <span className="block mt-0.5 text-slate-500">{log.details}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </section>
      </div>
    </details>
  );
}

export default async function RunsPage({ searchParams }: any) {
  const resolvedSearchParams = (await Promise.resolve(searchParams ?? {})) as SearchParams;
  if (!isAdminAllowed(resolvedSearchParams)) {
    return <LoginForm />;
  }

  const filters = getFilters(resolvedSearchParams);
  const page = Math.max(1, Number(asString(resolvedSearchParams.page)) || 1);
  const limit = 50;

  let items: BotRunReviewItem[];
  let totalCount = 0;

  try {
    const data = await listBotRunReviews(filters, page, limit);
    items = data.items;
    totalCount = data.totalCount;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load bot runs";
    return <SetupNotice message={message} />;
  }

  const password = asString(resolvedSearchParams.password);
  const errorCount = items.filter((item) => item.status === "error").length;
  const webSearchCount = items.filter((item) => item.usedWebSearch).length;
  const totalPages = Math.ceil(totalCount / limit);

  // Helper to build URL with search params
  const buildPageUrl = (newPage: number) => {
    const params = new URLSearchParams();
    if (password) params.set("password", password);
    if (filters.channel) params.set("channel", filters.channel);
    if (filters.intent) params.set("intent", filters.intent);
    if (filters.status) params.set("status", filters.status);
    if (filters.target) params.set("target", filters.target);
    if (filters.usedWebSearch) params.set("usedWebSearch", filters.usedWebSearch);
    params.set("page", newPage.toString());
    return `/admin/runs?${params.toString()}`;
  };

  const lowConfidenceCount = items.filter((item) => {
    const confidence = item.metadata.routerConfidence;
    return typeof confidence === "number" && confidence < 0.75;
  }).length;

  return (
    <main className="min-h-screen bg-[#f7f7fb] px-6 py-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-bu-purple">
              BU StudyMate
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-bu-ink">
              Run review
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Inspect router choices, answers, sources, and execution flags for recent
              chatbot runs.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Home
            </Link>
            <Link
              href={password ? `/admin/tickets?password=${encodeURIComponent(password)}` : "/admin/tickets"}
              className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-bu-purple/40 hover:text-bu-purple"
            >
              Open tickets
            </Link>
          </div>
        </header>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Loaded runs" value={items.length} />
          <Metric label="Errors" value={errorCount} />
          <Metric label="Used web search" value={webSearchCount} />
          <Metric label="Low confidence" value={lowConfidenceCount} />
        </section>

        <FilterBar filters={filters} password={password} />

        <section className="mt-6 space-y-4">
          {items.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500 shadow-sm">
              No bot runs match these filters.
            </div>
          ) : (
            items.map((item) => <RunCard key={item.id} item={item} />)
          )}
        </section>
        
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-6">
            <p className="text-sm text-slate-500">
              Showing page <span className="font-semibold text-slate-700">{page}</span> of <span className="font-semibold text-slate-700">{totalPages}</span> ({totalCount} total runs)
            </p>
            <div className="flex items-center gap-2">
              <Link
                href={page > 1 ? buildPageUrl(page - 1) : "#"}
                className={`inline-flex items-center justify-center rounded-md border border-slate-200 px-3 py-1 text-sm font-medium transition ${
                  page > 1
                    ? "bg-white text-slate-700 hover:bg-slate-50"
                    : "pointer-events-none bg-slate-100 text-slate-400 opacity-50"
                }`}
                aria-disabled={page <= 1}
              >
                Previous
              </Link>
              <Link
                href={page < totalPages ? buildPageUrl(page + 1) : "#"}
                className={`inline-flex items-center justify-center rounded-md border border-slate-200 px-3 py-1 text-sm font-medium transition ${
                  page < totalPages
                    ? "bg-white text-slate-700 hover:bg-slate-50"
                    : "pointer-events-none bg-slate-100 text-slate-400 opacity-50"
                }`}
                aria-disabled={page >= totalPages}
              >
                Next
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
