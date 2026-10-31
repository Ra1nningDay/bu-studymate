"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, CircleDot, Copy, Cpu, Database, ExternalLink, FileText, TriangleAlert } from "lucide-react";
import type { PlaygroundConversation, PlaygroundRun } from "@/src/dtos/playground.dto";
import { ChatSources } from "./chat-ui";
import { KnowledgeTraceDetails } from "./knowledge-trace-details";

export function RunTrace({ run, conversation, interactive = false }: { run: PlaygroundRun; conversation: PlaygroundConversation; interactive?: boolean }) {
  const [tab, setTab] = useState("trace");
  const [copyStatus, setCopyStatus] = useState("");
  if (!interactive) return <RunTraceReport run={run} conversation={conversation} />;
  const answer = conversation.messages.find((message) => message.id === run.assistantMessageId);
  const sources = answer?.sources ?? [];
  const messages = conversation.messages.filter((message) => message.id === run.userMessageId || message.id === run.assistantMessageId);
  const tabs = [{ id: "trace", label: "Trace" }, { id: "messages", label: "Messages" }, { id: "sources", label: `Sources (${sources.length})` }, { id: "raw", label: "Raw" }];
  return <>
    <div className="px-5 pb-4 text-xs text-slate-500">
      <div className="flex items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-2"><span className="shrink-0">Run ID</span><code className="truncate" title={run.id}>{run.id}</code><button aria-label="คัดลอก Run ID" onClick={async () => { try { await navigator.clipboard.writeText(run.id); setCopyStatus("คัดลอก Run ID แล้ว"); } catch { setCopyStatus("คัดลอกไม่สำเร็จ กรุณาคัดลอกจากแท็บ Raw"); } }} className="rounded p-1 hover:bg-slate-100 focus-visible:outline-emerald-700"><Copy aria-hidden="true" className="h-3.5 w-3.5" /></button></div><span className={`shrink-0 rounded-full px-3 py-1 font-medium ${run.status === "success" ? "bg-emerald-100 text-emerald-800" : run.status === "error" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"}`}>{run.status === "success" ? "Success" : run.status}</span></div>
      <p className="mt-2">{new Intl.DateTimeFormat("th-TH", { dateStyle: "short", timeStyle: "medium", timeZone: "Asia/Bangkok" }).format(new Date(run.createdAt))}</p>
      {copyStatus && <p role="status" className="mt-2">{copyStatus}</p>}
    </div>
    <div role="tablist" aria-label="มุมมอง Execution Trace" className="grid grid-cols-4 border-b border-slate-100 px-5">
      {tabs.map((item, index) => <button key={item.id} role="tab" id={`trace-${run.id}-${item.id}`} aria-selected={tab === item.id} aria-controls={`trace-panel-${run.id}`} tabIndex={tab === item.id ? 0 : -1} onClick={() => setTab(item.id)} onKeyDown={(event) => {
        const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : null;
        if (next !== null) { event.preventDefault(); setTab(tabs[next].id); document.getElementById(`trace-${run.id}-${tabs[next].id}`)?.focus(); }
      }} className={`border-b-2 px-1 py-3 text-xs focus-visible:outline-emerald-700 ${tab === item.id ? "border-emerald-600 font-medium text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>{item.label}</button>)}
    </div>
    <div role="tabpanel" id={`trace-panel-${run.id}`} aria-labelledby={`trace-${run.id}-${tab}`} tabIndex={0} className="min-h-0 flex-1 overflow-y-auto p-5 focus-visible:outline-emerald-700">
      {tab === "trace" && <div className="space-y-5">
        <ol className="space-y-0">
          {run.executionLog.map((entry, index) => <li key={index} className="relative border-l border-emerald-300 pb-6 pl-5 last:border-transparent last:pb-0">
            <span className="absolute -left-1.5 top-3 flex h-3 w-3 items-center justify-center rounded-full bg-emerald-700 text-[8px] text-white">{index + 1}</span>
            <details className="group">
              <summary className="flex cursor-pointer list-none items-start gap-3 rounded-lg focus-visible:outline-emerald-700"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${entry.action === "Error" || entry.status === "error" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>{entry.action === "Error" || entry.status === "error" ? <TriangleAlert aria-hidden="true" className="h-4 w-4" /> : <CircleDot aria-hidden="true" className="h-4 w-4" />}</span><span className="min-w-0 flex-1 pt-1"><span className="block break-words text-xs font-semibold">{index + 1}. {entry.action}</span><span className="mt-1 block truncate text-[11px] text-slate-500">{entry.details ?? "ขั้นตอนที่บันทึกไว้"}</span>{entry.status && <span className={`mt-2 inline-block rounded px-2 py-0.5 text-[10px] ${entry.status === "applied" ? "bg-emerald-50 text-emerald-700" : entry.status === "error" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-800"}`}>{{ applied: "สำเร็จ", fallback: "ใช้ fallback", skipped: "ข้าม", error: "ไม่สำเร็จ" }[entry.status]}</span>}</span>{entry.durationMs !== undefined && <span className="mt-2 shrink-0 text-[10px] tabular-nums text-slate-500">{entry.durationMs.toLocaleString()} ms</span>}<ChevronDown aria-hidden="true" className="mt-2 h-3.5 w-3.5 shrink-0 text-slate-500 transition group-open:rotate-180" /></summary>
              <div className="ml-[52px] mt-2 min-w-0"><p className="whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-xs leading-6 text-slate-600">{entry.details ?? "ไม่ได้บันทึกรายละเอียดเพิ่มเติม"}</p><KnowledgeTraceDetails data={entry.rag} /></div>
            </details>
          </li>)}
          {!run.executionLog.length && <li className="text-sm text-slate-500">ไม่ได้บันทึกรายขั้น</li>}
        </ol>
        {!!sources.length && <section className="rounded-xl border border-slate-200 p-3"><h3 className="mb-3 flex items-center gap-2 text-xs font-semibold"><FileText aria-hidden="true" className="h-4 w-4" />แหล่งข้อมูลที่ใช้ ({sources.length})</h3><ChatSources sources={sources} /></section>}
        <section className="rounded-xl border border-slate-200 text-xs">
          <div className="flex items-center justify-between gap-2 rounded-t-xl bg-slate-50 px-3 py-3"><h3 className="font-semibold">Total Latency</h3><span className="font-semibold">{run.latencyMs === null ? "ไม่ได้บันทึก" : `${run.latencyMs.toLocaleString()} ms`}</span></div>
          <div className="space-y-2.5 p-3">
            <p className="flex items-center gap-2"><Database aria-hidden="true" className="h-3.5 w-3.5 text-slate-500" /><span>Tokens: <span className="text-slate-500">{run.tokensUsed?.toLocaleString() ?? "ไม่ได้บันทึก"}</span></span></p>
            {run.routerModel || run.responseModel ? <>
              <p className="flex items-start gap-2"><Cpu aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-slate-500" /><span className="break-all">Router Model: <span className="text-slate-500">{run.routerModel ?? (run.routerType === "hard_guard" ? "Hard Guard" : "ไม่ได้บันทึก")}</span></span></p>
              <p className="flex items-start gap-2"><Cpu aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-slate-500" /><span className="break-all">Generator Model: <span className="text-slate-500">{run.responseModel ?? run.modelName ?? "ไม่ได้บันทึก"}</span></span></p>
            </> : <p className="flex items-start gap-2"><Cpu aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-slate-500" /><span className="break-all">Model: <span className="text-slate-500">{run.modelName ?? "ไม่ได้บันทึก"}</span></span></p>}
          </div>
        </section>
        <dl className="grid grid-cols-2 gap-3 text-xs">{[["Intent", run.intent], ["Target", run.selectedTarget], ["Router", run.routerType], ["Confidence", run.routerConfidence?.toFixed(2)], ["Session ก่อนตอบ", run.sessionState]].map(([label, value]) => <div key={label}><dt className="text-slate-500">{label}</dt><dd className="mt-1 break-words font-medium">{value ?? "ไม่ได้บันทึก"}</dd></div>)}</dl>
        <div className="rounded-lg bg-slate-50 p-3 text-xs leading-6"><h3 className="font-semibold">เหตุผลที่เลือกเส้นทาง</h3><p className="mt-1 whitespace-pre-wrap break-words text-slate-600">{run.routerReason ?? "ไม่ได้บันทึก"}</p><p className="mt-3 text-slate-500">Web search: {run.usedWebSearch ? "yes" : "no"} · Study memory: {run.usedStudyMemory ? "yes" : "no"} · Ticket flow: {run.usedTicketFlow ? "yes" : "no"}</p></div>
        {run.errorCode && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-800">Error: {run.errorCode}</p>}
        <p className="text-[11px] leading-5 text-slate-500">{run.executionLog.some((entry) => entry.rag) ? "RRF ใช้เวลาร่วมกับ Hybrid Retrieval (SQL) · Reranker แสดงลำดับ ไม่มี relevance score · Tokens แสดงยอดรวมที่ provider รายงาน" : "แสดงข้อมูลหลังจบเทิร์น ยังไม่ได้บันทึกเวลารายขั้น คะแนนแหล่งข้อมูล และ tokens แยก input/output"}</p>
        <Link href={`/admin/runs?run=${encodeURIComponent(run.id)}`} className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-3 text-xs font-medium hover:bg-emerald-50 focus-visible:outline-emerald-700"><ExternalLink aria-hidden="true" className="h-4 w-4" />ดูรายละเอียดในหน้า Bot Runs</Link>
      </div>}
      {tab === "messages" && <div className="space-y-3">{messages.map((message) => <article key={message.id} className={`rounded-xl p-3 ${message.role === "user" ? "bg-emerald-50" : "bg-slate-50"}`}><h3 className="text-xs font-semibold">{message.role === "user" ? "ผู้ใช้" : "StudyMate"}</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 [overflow-wrap:anywhere]">{message.text}</p></article>)}{!messages.length && <p className="text-sm text-slate-500">ไม่มีข้อความที่เชื่อมกับเทิร์นนี้</p>}</div>}
      {tab === "sources" && <div><h3 className="mb-3 text-sm font-semibold">แหล่งข้อมูลของคำตอบ</h3>{sources.length ? <ChatSources sources={sources} /> : <p className="text-xs text-slate-500">ไม่มีแหล่งข้อมูลที่บันทึก</p>}</div>}
      {tab === "raw" && <pre className="overflow-x-auto rounded-xl bg-slate-50 p-3 text-[11px] leading-6">{JSON.stringify(run, null, 2)}</pre>}
    </div>
  </>;
}

function RunTraceReport({ run, conversation }: { run: PlaygroundRun; conversation: PlaygroundConversation }) {
  const answer = conversation.messages.find((message) => message.id === run.assistantMessageId);
  const rows = [
    ["Intent", run.intent],
    ["Target", run.selectedTarget],
    ["Router", run.routerType],
    ["Confidence", run.routerConfidence?.toFixed(2)],
    ["Router Model", run.routerModel ?? (run.routerType === "hard_guard" ? "Hard Guard" : null)],
    ["Generator Model", run.responseModel ?? run.modelName],
    ["Tokens รวมที่บันทึก", run.tokensUsed?.toLocaleString()],
    ["เวลารวม", run.latencyMs === null ? null : `${run.latencyMs.toLocaleString()} ms`],
    ["Session ก่อนตอบ", run.sessionState]
  ];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-full px-3 py-1 font-semibold ${run.status === "error" ? "bg-rose-100 text-rose-800" : run.status === "success" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{run.status}</span>
        <code className="break-all text-slate-500">{run.id}</code>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-slate-500">{label}</dt>
            <dd className="mt-1 break-words font-medium text-slate-900">{value ?? "ไม่ได้บันทึก"}</dd>
          </div>
        ))}
      </dl>
      <section>
        <h3 className="text-sm font-semibold">เหตุผลที่เลือกเส้นทาง</h3>
        <p className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-sm leading-6">{run.routerReason ?? "ไม่ได้บันทึก"}</p>
      </section>
      <section>
        <h3 className="text-sm font-semibold">Execution log</h3>
        {run.executionLog.length ? (
          <ol className="mt-3 space-y-3 border-l-2 border-emerald-700/20 pl-4">
            {run.executionLog.map((entry, index) => (
              <li key={index} className="text-sm">
                <p className="font-medium">{index + 1}. {entry.action}</p>
                {entry.details && <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-slate-500">{entry.details}</p>}
                {(entry.status || entry.durationMs !== undefined) && <p className="mt-1 text-xs text-slate-500">{entry.status}{entry.durationMs !== undefined && ` · ${entry.durationMs.toLocaleString()} ms`}</p>}
                <KnowledgeTraceDetails data={entry.rag} expanded />
              </li>
            ))}
          </ol>
        ) : <p className="mt-2 text-sm text-slate-500">ไม่ได้บันทึกรายขั้น</p>}
      </section>
      <section>
        <h3 className="text-sm font-semibold">Flags ที่บันทึก</h3>
        <p className="mt-2 text-xs leading-6 text-slate-600">Web search: {run.usedWebSearch ? "yes" : "no"} · Study memory: {run.usedStudyMemory ? "yes" : "no"} · Ticket flow: {run.usedTicketFlow ? "yes" : "no"}</p>
      </section>
      {run.errorCode && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">Error: {run.errorCode}</p>}
      <section>
        <h3 className="text-sm font-semibold">แหล่งข้อมูลของคำตอบ</h3>
        {answer?.sources.length ? (
          <ul className="mt-2 space-y-2 text-xs">
            {answer.sources.map((url, index) => (
              <li key={index} className="break-all">
                {/^https?:\/\//i.test(url)
                  ? <a href={url} target="_blank" rel="noopener noreferrer" className="text-emerald-700 underline">{url}</a>
                  : <span>{url}</span>}
              </li>
            ))}
          </ul>
        ) : <p className="mt-2 text-sm text-slate-500">ไม่มีแหล่งข้อมูลที่บันทึก</p>}
      </section>
      <p className="border-t border-slate-100 pt-3 text-xs leading-5 text-slate-500">{run.executionLog.some((entry) => entry.rag) ? "RRF ใช้เวลาร่วมกับ Hybrid Retrieval (SQL) · Reranker แสดงลำดับ ไม่มี relevance score · แสดง snapshot ของเทิร์นที่บันทึก" : "Trace แสดงข้อมูลหลังจบเทิร์น เวลารายขั้นและ token แยกแต่ละ model call ยังไม่ได้บันทึก"}</p>
    </div>
  );
}
