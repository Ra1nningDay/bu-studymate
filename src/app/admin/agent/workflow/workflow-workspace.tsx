"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import type { BotRunReviewFilters, BotRunReviewItem } from "@/lib/bot-run-review";
import type { ExecutionLogEntry } from "@/src/dtos/playground.dto";
import { presentExecutionLog } from "@/src/presenters/playground.presenter";
import { deriveRunState, stateHint, stateLabel, workflowNodes, type NodeState } from "@/src/presenters/agent-workflow.presenter";
import { KnowledgeTraceDetails } from "../../chat/knowledge-trace-details";
import { WorkflowCanvas } from "./workflow-canvas";
import type { WorkflowLayout } from "./workflow-layout";

const panel = "min-w-0 rounded-lg border border-slate-200 bg-white p-4";
const control = "inline-flex min-h-11 items-center justify-center rounded-md border border-slate-200 px-3 text-sm hover:bg-slate-50 focus-visible:outline-emerald-700";
const legend: NodeState[] = ["success", "fallback", "failed", "skipped", "unknown", "unrecorded", "idle"];

function time(value: number | null | undefined) {
  return value == null ? "—" : `${value.toLocaleString("en-US")} ms`;
}

function date(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(value));
}

function Status({ value }: { value?: string }) {
  return <span className={`shrink-0 rounded px-2 py-1 text-xs ${value === "applied" || value === "success" ? "bg-emerald-50 text-emerald-800" : value === "error" ? "bg-rose-50 text-rose-800" : value === "fallback" ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600"}`}>{value ?? "ไม่ได้บันทึกสถานะ"}</span>;
}

function StepDetails({ step }: { step: ExecutionLogEntry }) {
  return <>
    <div className="mt-4 flex flex-wrap items-center gap-2"><Status value={step.status} /><span className="text-sm tabular-nums">{time(step.durationMs)}</span></div>
    <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 [overflow-wrap:anywhere]">{step.details ?? "ไม่มีรายละเอียดเพิ่มเติมที่บันทึกไว้"}</p>
    {step.action === "RRF Fusion" ? <p className="mt-3 text-xs leading-5 text-slate-600">เวลา RRF รวมอยู่ใน Hybrid Retrieval (SQL) แล้ว จึงไม่แสดงเวลาแยก</p>
      : step.durationMs === undefined && <p className="mt-3 text-xs text-slate-600">ไม่ได้บันทึกเวลาของขั้นตอนนี้</p>}
    <KnowledgeTraceDetails data={step.rag} expanded />
  </>;
}

let layoutPromise: Promise<WorkflowLayout> | undefined;
const loadLayout = () => layoutPromise ??= import("./workflow-layout").then(module => module.layoutWorkflow());

type Focus = { nodeId?: string; stepIndex?: number };

export function WorkflowWorkspace({ items, totalCount, filters, page, initialRunId, error }: {
  items: BotRunReviewItem[];
  totalCount: number;
  filters: BotRunReviewFilters;
  page: number;
  initialRunId?: string;
  error?: string | null;
}) {
  const [selectedId, setSelectedId] = useState(initialRunId ?? items[0]?.id ?? "");
  const selected = items.find(item => item.id === selectedId);
  const steps = useMemo(() => presentExecutionLog(selected?.metadata.executionLog), [selected]);
  const target = selected?.metadata.selectedTarget;
  const run = useMemo(() => deriveRunState(selected ? {
    steps, target, routerType: selected.metadata.routerType, runStatus: selected.status, hasAnswer: !!selected.assistantMessage, errorCode: selected.errorCode
  } : null), [selected, steps, target]);
  const nodeOfStep = (index: number) => Object.entries(run.nodes).find(([, info]) => info.stepIndexes.includes(index))?.[0];
  const firstNode = nodeOfStep(0);
  const [focus, setFocus] = useState<Focus>(() => firstNode ? { nodeId: firstNode } : steps.length ? { stepIndex: 0 } : { nodeId: "agent_router" });
  const [mode, setMode] = useState<"run" | "architecture">(selected ? "run" : "architecture");
  const [layout, setLayout] = useState<WorkflowLayout | null>(null);
  const [layoutFailed, setLayoutFailed] = useState(false);
  const detailsRef = useRef<HTMLElement>(null);
  const totalPages = Math.max(1, Math.ceil(totalCount / 12));
  const nodeDef = workflowNodes.find(item => item.id === focus.nodeId);
  const nodeInfo = nodeDef ? run.nodes[nodeDef.id] : undefined;
  const nodeSteps = nodeInfo?.stepIndexes ?? [];
  const inRun = mode === "run" && !!selected;

  useEffect(() => { loadLayout().then(setLayout).catch(() => setLayoutFailed(true)); }, []);

  function url(path: string, newPage = page, runId = selectedId) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => { if (value && value !== "all") params.set(key, value); });
    params.set("page", String(newPage));
    if (runId) params.set("run", runId);
    if (path === "/admin/runs") params.set("view", "trace");
    return `${path}?${params}`;
  }

  function chooseRun(id: string) {
    setSelectedId(id);
    setFocus({ nodeId: "agent_router" });
    if (id) setMode("run");
    window.history.replaceState(null, "", url("/admin/agent/workflow", page, id));
  }

  function showDetails() {
    if (window.innerWidth < 1280) {
      detailsRef.current?.focus({ preventScroll: true });
      detailsRef.current?.scrollIntoView({ block: "start" });
    }
  }

  const pagination = <nav aria-label="หน้ารายการ Workflow" className="flex gap-2">
    {page > 1 && <Link href={url("/admin/agent/workflow", page - 1, "")} className={control}>ก่อนหน้า</Link>}
    {page < totalPages && <Link href={url("/admin/agent/workflow", page + 1, "")} className={control}>ถัดไป</Link>}
  </nav>;

  return <div className="agent-workflow min-w-0 space-y-5">
    {error && <div role="alert" className="rounded-lg border border-amber-200 p-4 text-sm text-amber-800">{error}<a href={url("/admin/agent/workflow")} className="ml-3 inline-flex min-h-11 items-center font-medium underline">ลองใหม่</a></div>}
    <section aria-label="เลือก Bot Run" className={panel}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <label className="min-w-0 flex-1 basis-full text-sm font-medium sm:basis-80">Bot Run ที่ตรวจสอบ
          <select aria-label="Bot Run ที่ตรวจสอบ" value={selectedId} onChange={event => chooseRun(event.target.value)} disabled={!items.length}
            className="mt-2 block h-11 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm font-normal focus-visible:outline-emerald-700 disabled:text-slate-600">
            <option value="">เลือก run</option>
            {!selected && selectedId && <option value={selectedId}>ไม่พบ run ที่เลือกในหน้านี้</option>}
            {items.map(item => <option key={item.id} value={item.id}>{date(item.createdAt)} · {item.metadata.channel ?? "ไม่ทราบช่องทาง"} · {item.status} · {item.id.slice(0, 8)} · {item.userMessage?.content.slice(0, 65) ?? "ไม่มีข้อความ"}</option>)}
          </select>
        </label>
        <a href={url("/admin/agent/workflow")} className={control}>รีเฟรช</a>
        {selected && <Link href={url("/admin/runs")} className={control}>เปิด Execution Trace <ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" /></Link>}
        <div className="hidden sm:block">{pagination}</div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
        <p>{totalCount.toLocaleString("en-US")} runs ในช่วงและตัวกรองนี้ · เวลาไทย · หน้า {page.toLocaleString("en-US")} / {totalPages.toLocaleString("en-US")}</p>
        <div className="sm:hidden">{pagination}</div>
      </div>
      {!error && !items.length && <p role="status" className="mt-4 text-sm">ไม่มี Bot Runs ในหน้านี้ ลองเปลี่ยนช่วงวันที่{page > 1 && <> หรือ <Link href={url("/admin/agent/workflow", 1, "")} className="text-emerald-800 underline">กลับหน้าแรก</Link></>}</p>}
      {!selected && selectedId && <p role="status" className="mt-4 text-sm">ไม่พบ run ที่เลือกในหน้านี้ กรุณาเลือก run จากรายการ</p>}
      {selected?.errorCode && <p role="alert" className="mt-3 break-all text-sm text-rose-800">Error: {selected.errorCode} · ระบบบันทึกเฉพาะข้อผิดพลาดระดับ run ไม่ระบุขั้นตอนที่ล้มเหลว</p>}
    </section>

    {/* The existing sheet width is split into (1fr + 360px) + one 20px gutter. */}
    <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-5">
        <section aria-labelledby="workflow-map-title" className={panel}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="workflow-map-title" className="text-base font-semibold">System Workflow Map</h2>
              <p className="mt-2 text-xs leading-5 text-slate-600">โครงสร้างจาก source code · Router target: {target ?? "ไม่ได้บันทึก"} · แสดงจากบันทึกที่เก็บไว้ ไม่ใช่การทำงานแบบ live</p>
            </div>
            <div role="group" aria-label="มุมมอง" className="flex shrink-0 gap-1 rounded-md border border-slate-200 p-1">
              {([["run", "Run Trace"], ["architecture", "System Architecture"]] as const).map(([value, label]) =>
                <button key={value} type="button" aria-pressed={mode === value} onClick={() => setMode(value)}
                  className={`min-h-9 rounded px-3 text-sm focus-visible:outline-emerald-700 ${mode === value ? "bg-slate-900 text-white" : "hover:bg-slate-50"}`}>{label}</button>)}
            </div>
          </div>
          {mode === "run" && !selected && <p role="status" className="mt-3 text-xs text-slate-600">เลือก Bot Run เพื่อดูเส้นทางที่ทำงานจริง ตอนนี้แสดงโครงสร้างระบบ</p>}
          <div className="mt-4">
            {layout ? <WorkflowCanvas layout={layout} run={run} mode={inRun ? "run" : "architecture"} runKey={selectedId} selectedId={focus.nodeId ?? null}
              onSelect={id => { setFocus({ nodeId: id }); showDetails(); }} />
              : <p role="status" className="wf-canvas flex items-center justify-center text-sm text-slate-600">{layoutFailed ? "คำนวณตำแหน่งแผนภาพไม่สำเร็จ ใช้รายการ Recorded Steps แทนได้" : "กำลังจัดวางแผนภาพ…"}</p>}
          </div>
          <ul aria-label="สัญลักษณ์สถานะ" className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
            {legend.map(state => <li key={state} className="flex items-center gap-1.5" title={stateHint[state]}><span aria-hidden="true" data-state={state} className="wf-swatch" />{stateLabel[state]}</li>)}
          </ul>
        </section>

        <section aria-labelledby="workflow-steps-title" className={panel}>
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="workflow-steps-title" tabIndex={-1} className="text-base font-semibold">Recorded Steps</h2><span className="text-xs text-slate-600">{steps.length} ขั้นตอนที่บันทึก</span></div>
          {steps.length ? <ol className="workflow-steps mt-4" aria-label="ขั้นตอนที่บันทึก">
            {steps.map((entry, index) => {
              const owner = nodeOfStep(index);
              const pressed = owner ? focus.nodeId === owner : focus.stepIndex === index;
              return <li key={index}>
                <button type="button" aria-pressed={pressed} onClick={() => { setFocus(owner ? { nodeId: owner } : { stepIndex: index }); showDetails(); }}
                  className={`flex min-h-14 w-full flex-wrap items-center gap-2 rounded-md border px-3 py-3 text-left focus-visible:outline-emerald-700 ${pressed ? "border-emerald-600 bg-emerald-50/40" : "border-slate-200 hover:border-slate-400"}`}>
                  <span className="min-w-0 flex-1 basis-40 break-words text-sm font-medium">{entry.action}</span><Status value={entry.status} /><span className="ml-auto w-20 text-right text-xs tabular-nums">{entry.action === "RRF Fusion" ? "รวมใน SQL" : time(entry.durationMs)}</span>
                </button>
              </li>;
            })}
          </ol> : <p className="mt-4 text-sm leading-6 text-slate-600">{selected ? "Run นี้ไม่มีขั้นตอนที่บันทึกไว้ จึงแสดงได้เฉพาะข้อมูลของ run" : "เลือก Bot Run เพื่อดูขั้นตอนที่ทำงานจริง"}</p>}
          <p className="mt-4 text-xs leading-5 text-slate-600">สถานะเป็นของขั้นตอนใน run นี้ · ข้อมูลที่ไม่ได้บันทึกแสดง — · เวลา RRF รวมอยู่ใน Hybrid Retrieval</p>
        </section>
      </div>

      <aside ref={detailsRef} tabIndex={-1} aria-label="Node Inspector" className={`${panel} scroll-mt-4 focus-visible:outline-emerald-700 xl:sticky xl:top-4`}>
        <h2 className="text-base font-semibold">Node Inspector</h2>
        <a href="#workflow-steps-title" className="mt-2 inline-flex min-h-11 items-center text-sm text-emerald-800 underline xl:hidden">กลับไปขั้นตอน</a>
        {selected && <div className="mt-3 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3"><Status value={selected.status} /><span className="text-xs tabular-nums">เวลารวม {time(selected.latencyMs)}</span><span className="text-xs tabular-nums">{selected.tokensUsed?.toLocaleString("en-US") ?? "—"} tokens</span></div>}
        {nodeDef && nodeInfo ? <div className="mt-4 space-y-4">
          <div>
            <h3 className="break-words text-sm font-semibold">{nodeDef.label}</h3>
            <p className="mt-1 break-all text-xs text-slate-600">{nodeDef.source}</p>
            {inRun && <p className="mt-2 text-xs"><span data-state={nodeInfo.state} className="wf-swatch mr-1.5 align-middle" />{stateLabel[nodeInfo.state]} · {stateHint[nodeInfo.state]}</p>}
          </div>
          <p className="text-sm leading-6">{nodeDef.description}</p>
          <dl className="space-y-3 text-sm leading-6">
            <div><dt className="text-xs font-medium text-slate-600">Inputs</dt><dd>{nodeDef.inputs}</dd></div>
            <div><dt className="text-xs font-medium text-slate-600">Outputs</dt><dd>{nodeDef.outputs}</dd></div>
            {inRun && <div><dt className="text-xs font-medium text-slate-600">Latency</dt><dd className="tabular-nums">{nodeDef.id === "rrf_fusion" ? "รวมอยู่ใน Hybrid Retrieval (SQL)" : nodeInfo.durationMs !== undefined ? time(nodeInfo.durationMs) : "ไม่ได้บันทึก"}</dd></div>}
          </dl>
          {inRun && nodeInfo.note && <p className="text-xs leading-5 text-slate-600">{nodeInfo.note}</p>}
          {inRun && nodeSteps.some(index => steps[index].status === "error") && <p role="alert" className="text-sm text-rose-800">Error: {nodeSteps.map(index => steps[index]).filter(step => step.status === "error").map(step => step.details ?? step.action).join(" · ")}</p>}
          {inRun && (nodeSteps.length ? <section aria-label="Execution Details" className="border-t border-slate-100 pt-3">
            <h4 className="text-xs font-medium text-slate-600">Execution Details</h4>
            {nodeSteps.map(index => <div key={index} className="mt-2"><p className="break-words text-sm font-medium">{steps[index].action}</p><StepDetails step={steps[index].action === "RRF Fusion" ? { ...steps[index], durationMs: undefined } : steps[index]} /></div>)}
          </section> : <p className="text-xs leading-5 text-slate-600">{nodeInfo.state === "idle" ? "Run นี้ไม่ได้ผ่านโหนดนี้" : "ไม่มีขั้นตอนที่บันทึกสำหรับโหนดนี้"}</p>)}
        </div>
          : steps[focus.stepIndex ?? -1] ? <div className="mt-4"><h3 className="break-words text-sm font-semibold">{steps[focus.stepIndex!].action}</h3><p className="mt-1 text-xs text-slate-600">ขั้นตอนนี้ไม่ตรงกับโหนดใดในโครงสร้างปัจจุบัน</p><StepDetails step={steps[focus.stepIndex!]} /></div>
            : <p className="mt-4 text-sm leading-6 text-slate-600">เลือกโหนดหรือขั้นตอนเพื่อดูรายละเอียด</p>}
        {selected && <section className="mt-5 border-t border-slate-100 pt-4">
          <details className="mb-4 text-sm"><summary className="min-h-11 cursor-pointer content-center font-medium focus-visible:outline-emerald-700">ข้อความผู้ใช้</summary><p className="mt-2 whitespace-pre-wrap break-words leading-6 [overflow-wrap:anywhere]">{selected.userMessage?.content ?? "ไม่มีข้อความผู้ใช้ที่เชื่อมกับ run นี้"}</p></details>
          <h3 className="text-sm font-semibold">Router Decision</h3><p className="mt-2 break-words text-sm leading-6">{selected.metadata.routerReason ?? "ไม่ได้บันทึกเหตุผล"}</p>
          <p className="mt-2 break-all text-xs leading-5 text-slate-600">Target: {target ?? "—"} · Router model: {selected.routerModel ?? "—"}</p>
          <h3 className="mt-4 text-sm font-semibold">Answer Sources ({selected.assistantMessage?.sourceUrls.length ?? 0})</h3>
          {selected.assistantMessage?.sourceUrls.length ? <ul className="mt-2 space-y-2">{selected.assistantMessage.sourceUrls.map((source, index) => <li key={index} className="break-all text-xs leading-5">{/^https?:\/\//i.test(source) ? <a href={source} target="_blank" rel="noopener noreferrer" className="text-emerald-800 underline">{source}</a> : source}</li>)}</ul> : <p className="mt-2 text-xs text-slate-600">ไม่มีแหล่งข้อมูลที่บันทึกไว้</p>}
        </section>}
      </aside>
    </div>
  </div>;
}
