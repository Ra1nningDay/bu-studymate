"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { BotRunReviewFilters, BotRunReviewItem } from "@/lib/bot-run-review";
import { AdminPageHeader } from "../admin-page-header";
import { DateRangeFilter } from "../date-range-filter";
import { presentExecutionLog } from "@/src/presenters/playground.presenter";
import { KnowledgeTraceDetails } from "../chat/knowledge-trace-details";

type Props = {
  items: BotRunReviewItem[];
  totalCount: number;
  filters: BotRunReviewFilters;
  today: string;
  page: number;
  limit: number;
  initialRunId?: string;
  initialView?: string;
};

const intentOptions = ["ASK_BU_INFO", "ASK_FRESH_INFO", "ASK_STUDY_MEMORY", "LIST_ASSIGNMENTS", "CREATE_TICKET", "CHECK_TICKET_STATUS", "GENERAL_CHAT", "OUT_OF_SCOPE", "UNKNOWN", "ADD_STUDY_NOTE"];
const targets = ["knowledge_base", "web_search", "study_memory", "ticket", "general_chat", "out_of_scope", "unknown"];
const outline = "rounded-md border border-slate-200 bg-white transition hover:bg-slate-50 focus-visible:outline-emerald-600";
const panel = "rounded-lg border border-slate-200/80 bg-white";
const tabs = ["Overview", "Messages", "Execution Trace", "Retrieved Sources", "Raw"] as const;
type Tab = typeof tabs[number];

function Icon({ name, className = "h-5 w-5" }: { name: string; className?: string }) {
  const paths: Record<string, string> = {
    message: "M21 11.5a8.5 8.5 0 01-8.5 8.5H3l2-5a8.5 8.5 0 1116-3.5z M8 11h.01 M12 11h.01 M16 11h.01",
    check: "M9 12l2 2 4-4 M22 12a10 10 0 11-20 0 10 10 0 0120 0",
    clock: "M12 6v6l4 2 M22 12a10 10 0 11-20 0 10 10 0 0120 0",
    alert: "M12 3L2 21h20L12 3z M12 9v5 M12 17h.01",
    refresh: "M20 7v5h-5 M4 17v-5h5 M5 8a8 8 0 0113-3l2 3 M19 16a8 8 0 01-13 3l-2-3",
    search: "M21 21l-5-5 M18 10a8 8 0 11-16 0 8 8 0 0116 0",
    right: "M9 5l7 7-7 7",
    left: "M15 5l-7 7 7 7",
    external: "M14 3h7v7 M21 3L10 14 M10 3H3v18h18v-7",
    globe: "M22 12a10 10 0 11-20 0 10 10 0 0120 0 M2 12h20 M12 2a20 20 0 010 20 20 20 0 010-20",
    calendar: "M4 5h16v16H4z M8 3v4 M16 3v4 M4 10h16",
    trace: "M6 6h.01 M18 6h.01 M12 18h.01 M6 9v3l6 3 6-3V9 M9 6h6"
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}><path d={paths[name] ?? paths.message} /></svg>;
}

function Badge({ status }: { status: string }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs ${status === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : status === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>{status}</span>;
}

function date(value: string, timeOnly = false) {
  return new Intl.DateTimeFormat("en-GB", { ...(timeOnly ? { hour: "2-digit", minute: "2-digit" } as const : { dateStyle: "medium", timeStyle: "medium" } as const), timeZone: "Asia/Bangkok" }).format(new Date(value));
}

function latency(value: number | null) {
  return value === null ? "—" : `${(value / 1000).toFixed(1)}s`;
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="bg-white p-5"><p className="text-sm text-slate-600">{label}</p><p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p><p className="mt-2 text-xs text-slate-600">{note}</p></div>;
}

function SelectFilter({ label, name, options, value }: { label: string; name: string; options: string[]; value?: string | null }) {
  return <label className="min-w-0 text-xs text-slate-600">{label}<select name={name} defaultValue={value ?? "all"} className={`${outline} mt-1.5 block h-9 w-full px-2 text-xs text-slate-800`}><option value="all">All</option>{options.map(option => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="grid min-w-0 grid-cols-[90px_minmax(0,1fr)] gap-3 text-[13px] leading-6"><dt className="text-slate-600">{label}</dt><dd className="min-w-0 break-words text-slate-800">{children ?? "—"}</dd></div>;
}

function Timeline({ item }: { item: BotRunReviewItem }) {
  const logs = presentExecutionLog(item.metadata.executionLog);
  return <section className="border-t border-slate-200 py-4"><h3 className="text-sm font-semibold">Execution Timeline</h3>{logs.length ? <ol className="mt-3 divide-y divide-slate-100">{logs.map((entry, index) => <li key={index}><details><summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-3 py-2 text-[13px] focus-visible:outline-emerald-700"><span className="min-w-0 flex-1 break-words font-medium">{index + 1}. {entry.action}</span><span className="text-xs text-slate-600">{entry.status ?? "ไม่ได้บันทึกสถานะ"} · {entry.action === "RRF Fusion" ? "รวมใน Hybrid Retrieval" : entry.durationMs === undefined ? "—" : `${entry.durationMs.toLocaleString()} ms`}</span><Icon name="right" className="h-3 w-3 text-slate-600" /></summary><p className="mb-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">{entry.details ?? "No additional details recorded."}</p><KnowledgeTraceDetails data={entry.rag} /></details></li>)}</ol> : <p className="mt-3 text-sm text-slate-600">No execution steps recorded.</p>}<p className="mt-3 text-xs text-slate-600">Missing step durations show —. RRF timing is included in Hybrid Retrieval.</p></section>;
}

function RunDetail({ item, tab }: { item: BotRunReviewItem; tab: Tab }) {
  const sources = item.assistantMessage?.sourceUrls ?? [];
  if (tab === "Raw") return <pre className={`${panel} max-h-[650px] overflow-auto whitespace-pre-wrap break-all p-3 text-xs leading-5`}>{JSON.stringify(item, null, 2)}</pre>;
  if (tab === "Retrieved Sources") return <section className="py-3"><h3 className="text-sm font-semibold">Retrieved Sources ({sources.length})</h3>{sources.length ? <ul className="mt-3 space-y-3">{sources.map((url, index) => <li key={index} className="break-all text-xs">{/^https?:\/\//i.test(url) ? <a href={url} target="_blank" rel="noopener noreferrer" className="text-emerald-700 underline">{url}</a> : url}</li>)}</ul> : <p className="mt-3 text-xs text-slate-600">No sources recorded.</p>}</section>;
  if (tab === "Execution Trace") return <div className="space-y-3"><Timeline item={item} /><section className={`${panel} p-3 text-xs`}><h3 className="font-semibold">Router decision</h3><dl className="mt-3 space-y-3"><Field label="Type">{item.metadata.routerType}</Field><Field label="Confidence">{item.metadata.routerConfidence?.toFixed(2)}</Field><Field label="Target">{item.metadata.selectedTarget}</Field><Field label="Needs web">{item.metadata.needsWebSearch === null ? "—" : item.metadata.needsWebSearch ? "yes" : "no"}</Field></dl><p className="mt-3 whitespace-pre-wrap break-words leading-5 text-slate-600">{item.metadata.routerReason ?? "No router reason recorded."}</p><p className="mt-3 border-t border-slate-100 pt-3 leading-6 text-slate-600">Saved flags · OpenAI: {item.usedOpenAI ? "yes" : "no"} · Web search: {item.usedWebSearch ? "yes" : "no"} · Memory: {item.usedStudyMemory ? "yes" : "no"} · Ticket: {item.usedTicketFlow ? "yes" : "no"}</p></section></div>;
  return <div className="space-y-3">
    {tab === "Overview" && <><section className="py-3"><h3 className="text-sm font-semibold">Basic Information</h3><dl className="mt-4 grid gap-3 2xl:grid-cols-2 2xl:gap-x-6">
      <Field label="Run ID"><code className="break-all">{item.id}</code></Field><Field label="Router Model">{item.routerModel ?? (item.metadata.routerType === "hard_guard" ? "Hard Guard" : "—")}</Field>
      <Field label="Generator Model">{item.responseModel ?? item.modelName ?? "—"}</Field><Field label="Overall Model">{item.modelName ?? "—"}</Field>
      <Field label="Intent">{item.intent ?? "UNKNOWN"}</Field><Field label="Latency">{item.latencyMs === null ? "—" : `${item.latencyMs.toLocaleString()} ms (${latency(item.latencyMs)})`}</Field>
      <Field label="Status"><Badge status={item.status} /></Field><Field label="Tokens">{item.tokensUsed?.toLocaleString()}</Field>
      <Field label="Channel">{item.metadata.channel ?? "unknown"}</Field><Field label="User"><span className="break-all">{item.lineUserId}</span></Field>
      <Field label="Timestamp">{date(item.createdAt)}</Field><Field label="Target">{item.metadata.selectedTarget}</Field>
    </dl></section><Timeline item={item} /></>}
    {tab === "Messages" && <section className="py-3"><h3 className="text-sm font-semibold">User Message</h3><p className="mt-2 whitespace-pre-wrap break-words rounded-md bg-slate-50 p-3 text-sm leading-6">{item.userMessage?.content ?? "No user message linked."}</p></section>}
    {item.errorCode && <p role="alert" className="break-words rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">Error: {item.errorCode}</p>}
    <section className="py-3"><h3 className="text-sm font-semibold">Final Response</h3><p className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md bg-slate-50 p-3 text-sm leading-6">{item.assistantMessage?.content ?? "No reply linked yet."}</p></section>
  </div>;
}

export function RunsWorkspace({ items, totalCount, filters, today, page, limit, initialRunId, initialView }: Props) {
  const { from, to, ...serverFilters } = filters;
  const [selectedId, setSelectedId] = useState(initialRunId ?? items[0]?.id);
  const [tab, setTab] = useState<Tab>(initialView === "trace" ? "Execution Trace" : "Overview");
  const [search, setSearch] = useState("");
  const [model, setModel] = useState("all");
  const visible = items.filter(item => (model === "all" || item.modelName === model) && [item.id, item.intent, item.lineUserId, item.userMessage?.content, item.assistantMessage?.content].some(value => value?.toLocaleLowerCase().includes(search.toLocaleLowerCase())));
  const selected = visible.find(item => item.id === selectedId) ?? visible[0];
  const selectedIndex = visible.findIndex(item => item.id === selected?.id);
  const measured = items.filter(item => item.latencyMs !== null);
  const average = measured.length ? measured.reduce((sum, item) => sum + item.latencyMs!, 0) / measured.length : null;
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  function url(newPage = page, runId?: string, path = "/admin/runs") {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => { if (value && value !== "all") params.set(key, value); });
    params.set("page", String(newPage));
    if (runId) params.set("run", runId);
    if (path === "/admin/runs" && tab === "Execution Trace") params.set("view", "trace");
    return `${path}?${params}`;
  }

  const pageNumbers = Array.from({ length: Math.min(5, totalPages) }, (_, index) => Math.max(1, Math.min(page - 2, totalPages - 4)) + index);
  return <main className="min-w-0">
    <AdminPageHeader
      title="Bot Runs"
      description="ประวัติการทำงานของบอท การจำแนก Intent ผลลัพธ์โมเดล และตัวชี้วัดประสิทธิภาพ"
      actions={
        <>
          {items.length > 0 && (
            <span className={`${panel} inline-flex items-center gap-2 px-3 py-2 text-xs text-slate-600`}>
              <Icon name="calendar" className="h-4 w-4" />
              Page {page} · Latest {date(items[0].createdAt)}
            </span>
          )}
          <a
            href={url(page, selected?.id)}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 focus-visible:outline-emerald-600"
          >
            <Icon name="refresh" className="h-4 w-4" />
            รีเฟรช
          </a>
        </>
      }
    />
    <div className="mt-5"><DateRangeFilter from={from ?? ""} to={to ?? ""} today={today} action="/admin/runs" preservedFilters={serverFilters} /></div>
    <section aria-label="Run metrics" className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 xl:grid-cols-4">
      <Metric label="Total Runs" value={totalCount.toLocaleString()} note="Matching server filters" />
      <Metric label="Success Rate" value={items.length ? `${(items.filter(item => item.status === "success").length / items.length * 100).toFixed(1)}%` : "—"} note="On this page" />
      <Metric label="Avg. Latency" value={latency(average)} note={`On this page · ${measured.length} measured`} />
      <Metric label="Failed Runs" value={String(items.filter(item => item.status === "error").length)} note="On this page" />
    </section>
    <div className="mt-5 grid min-w-0 items-start gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <section aria-label="Bot run list" className={`${panel} min-w-0 overflow-hidden`}>
        <div className="p-4">
          <h2 className="mb-3 text-sm font-semibold">ตัวกรอง Runs เพิ่มเติม</h2>
          <form method="GET" aria-label="ตัวกรอง Runs เพิ่มเติม" className="grid grid-cols-2 items-end gap-3 sm:grid-cols-4 2xl:grid-cols-[minmax(0,2.5fr)_repeat(4,minmax(0,1fr))]">
            <input type="hidden" name="from" value={from ?? ""} />
            <input type="hidden" name="to" value={to ?? ""} />
            <label className="relative col-span-2 block sm:col-span-4 2xl:col-span-1"><span className="sr-only">Search this page</span><span className="absolute left-3 top-2.5 text-slate-400"><Icon name="search" className="h-4 w-4" /></span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search runs on this page…" className={`${outline} h-9 w-full pl-9 pr-3 text-xs placeholder:text-slate-600`} /></label>
            <SelectFilter label="Status" name="status" options={["success", "error", "processing"]} value={filters.status} />
            <SelectFilter label="Intent" name="intent" options={intentOptions} value={filters.intent} />
            <SelectFilter label="Channel" name="channel" options={["line", "web"]} value={filters.channel} />
            <label className="text-xs text-slate-600">Model on page<select value={model} onChange={event => setModel(event.target.value)} className={`${outline} mt-1.5 block h-9 w-full px-2 text-xs text-slate-800`}><option value="all">All</option>{Array.from(new Set(items.map(item => item.modelName).filter((name): name is string => Boolean(name)))).map(name => <option key={name}>{name}</option>)}</select></label>
            <div className="col-span-full flex items-start justify-between gap-3"><details className="min-w-0 flex-1 text-xs text-slate-600"><summary className="w-fit cursor-pointer py-2 hover:text-emerald-700">More filters</summary><div className="mt-2 grid grid-cols-2 gap-3"><SelectFilter label="Target" name="target" options={targets} value={filters.target} /><SelectFilter label="Web search" name="usedWebSearch" options={["true", "false"]} value={filters.usedWebSearch} /></div></details><button className="h-11 rounded-md sm:h-9 bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800 focus-visible:outline-emerald-600">Apply filters</button><Link href={`/admin/runs?${new URLSearchParams({ from: from ?? "", to: to ?? "" })}`} className={`${outline} inline-flex h-11 items-center sm:h-9 justify-center px-3 text-xs text-slate-600`}>Reset</Link></div>
          </form>
        </div>
        <div className="overflow-x-auto px-2">
          <table className="w-full whitespace-nowrap text-left text-[13px] [&_tbody_td]:py-2.5"><caption className="sr-only">Saved bot runs, newest first. Select a run to inspect its details.</caption><thead className="text-slate-600"><tr>{["Run ID", "Status", "Intent", "Model", "Latency", "Tokens", "Channel", "Time ↓"].map(label => <th key={label} scope="col" className="px-2 py-3 font-medium first:sticky first:left-0 first:bg-white" style={{ textAlign: label === "Latency" || label === "Tokens" ? "right" : undefined }}>{label}</th>)}</tr></thead><tbody>
            {visible.map(item => <tr key={item.id} className={`border-b border-slate-100 ${selected?.id === item.id ? "bg-slate-100" : "hover:bg-slate-50"}`}>
              <td className={`sticky left-0 px-2 py-3 ${selected?.id === item.id ? "bg-slate-100" : "bg-white"}`}><button onClick={() => setSelectedId(item.id)} aria-pressed={selected?.id === item.id} aria-label={`Inspect run ${item.id}`} title={item.id} className="block max-w-[105px] truncate font-mono font-semibold text-emerald-700 underline-offset-4 hover:underline focus-visible:outline-emerald-600">{item.id}</button></td>
              <td className="px-2 py-3"><Badge status={item.status} /></td><td className="max-w-[125px] truncate px-2 py-3" title={item.intent ?? "UNKNOWN"}>{item.intent?.toLowerCase() ?? "unknown"}</td><td className="max-w-[100px] truncate px-2 py-3 text-slate-600" title={item.modelName ?? undefined}>{item.modelName ?? "—"}</td><td className="px-2 py-3 text-right">{latency(item.latencyMs)}</td><td className="px-2 py-3 text-right">{item.tokensUsed?.toLocaleString() ?? "—"}</td><td className="px-2 py-3"><span className="inline-flex items-center gap-1.5">{item.metadata.channel === "line" ? <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-800">LINE</span> : <Icon name="globe" className="h-4 w-4" />}{item.metadata.channel === "web" ? "Web" : item.metadata.channel ?? "unknown"}</span></td><td className="px-2 py-3 text-slate-600"><time dateTime={item.createdAt} title={date(item.createdAt)}>{date(item.createdAt, true)}</time></td>
            </tr>)}
          </tbody></table>
          {!visible.length && <p role="status" className="px-4 py-16 text-center text-sm text-slate-600">{items.length ? "No runs on this page match your search or model." : "No bot runs match these filters."}</p>}
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-3 px-4 py-7 text-xs text-slate-600"><p aria-live="polite">{visible.length} shown · {totalCount ? `${(page - 1) * limit + 1}–${(page - 1) * limit + items.length}` : "0"} of {totalCount.toLocaleString()} runs</p><nav aria-label="Run pages" className="flex items-center gap-1">
          <Link aria-label="Previous page" aria-disabled={page <= 1} tabIndex={page <= 1 ? -1 : undefined} href={url(Math.max(1, page - 1))} className={`${outline} p-2 ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}><Icon name="left" className="h-3 w-3" /></Link>
          {pageNumbers.map(number => <Link key={number} aria-current={page === number ? "page" : undefined} href={url(number)} className={`rounded-md px-3 py-2 ${page === number ? "bg-slate-900 text-white" : "hover:bg-slate-50"}`}>{number}</Link>)}
          <Link aria-label="Next page" aria-disabled={page >= totalPages} tabIndex={page >= totalPages ? -1 : undefined} href={url(page + 1)} className={`${outline} p-2 ${page >= totalPages ? "pointer-events-none opacity-40" : ""}`}><Icon name="right" className="h-3 w-3" /></Link>
        </nav></footer>
      </section>
      <section aria-label="Run details" className={`${panel} min-w-0 p-3 xl:sticky xl:top-4`}>
        {selected ? <>
          <header className="flex flex-wrap items-start justify-between gap-3 px-1 py-2"><div className="min-w-0 flex-1 basis-full sm:basis-0"><div className="flex items-center gap-2"><Badge status={selected.status} /><h2 className="truncate text-sm font-semibold" title={selected.id}>Run {selected.id.slice(0, 8)}</h2></div><p className="mt-1 text-xs text-slate-600">{date(selected.createdAt)} · Bangkok</p></div><div className="flex items-center gap-2">
            <Link href={url(page, selected.id, "/admin/agent/workflow")} className={`${outline} inline-flex min-h-11 items-center px-2 py-2 text-xs`}>ดู Workflow</Link>
            <Link href={url(page, selected.id)} target="_blank" rel="noopener noreferrer" className={`${outline} inline-flex min-h-11 items-center gap-2 px-2 py-2 text-xs`}><Icon name="external" className="h-3 w-3" />Open in new tab</Link>
            <button aria-label="Previous run" disabled={selectedIndex <= 0} onClick={() => setSelectedId(visible[selectedIndex - 1].id)} className={`${outline} flex min-h-11 min-w-11 items-center justify-center p-2 disabled:opacity-40`}><Icon name="left" className="h-3 w-3" /></button>
            <button aria-label="Next run" disabled={selectedIndex >= visible.length - 1} onClick={() => setSelectedId(visible[selectedIndex + 1].id)} className={`${outline} flex min-h-11 min-w-11 items-center justify-center p-2 disabled:opacity-40`}><Icon name="right" className="h-3 w-3" /></button>
          </div></header>
          <nav aria-label="Run detail views" className="mb-3 mt-3 flex overflow-x-auto border-b border-slate-100">{tabs.map(name => <button key={name} aria-current={tab === name ? "page" : undefined} onClick={() => setTab(name)} className={`whitespace-nowrap border-b-2 px-2 py-3 text-xs focus-visible:outline-emerald-600 ${tab === name ? "border-emerald-500 font-semibold text-slate-900" : "border-transparent text-slate-600 hover:text-emerald-700"}`}>{name}{name === "Retrieved Sources" ? ` (${selected.assistantMessage?.sourceUrls.length ?? 0})` : ""}</button>)}</nav>
          <RunDetail key={selected.id} item={selected} tab={tab} />
        </> : <div className="py-20 text-center text-sm text-slate-600">Select a run to inspect its details.</div>}
      </section>
    </div>
  </main>;
}
