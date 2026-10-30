"use client";

import Link from "next/link";
import { useState } from "react";
import { Copy, Check, Printer, ChevronDown, ExternalLink } from "lucide-react";
import type { ConversationReportData, ReportTurn } from "@/src/presenters/report.presenter";

export function ReportView({ report }: { report: ConversationReportData }) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandAll, setExpandAll] = useState(false);

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 font-sans text-slate-900 print:max-w-none print:p-0">
      {/* Top utility bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 print:hidden">
        <Link
          href="/admin/chat"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
        >
          ← กลับ Web Chat
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpandAll(!expandAll)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-emerald-600"
          >
            {expandAll ? "ย่อ Raw JSON ทั้งหมด" : "ขยาย Raw JSON ทั้งหมด"}
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-emerald-600"
          >
            <Printer className="h-3.5 w-3.5" aria-hidden="true" />
            พิมพ์รายงาน (PDF)
          </button>
        </div>
      </div>

      {/* Quick turn jump pills */}
      <div className="mt-4 flex flex-wrap items-center gap-1.5 print:hidden">
        <span className="text-xs font-medium text-slate-500">ข้ามไปที่ Turn:</span>
        {report.turns.map((t) => (
          <a
            key={t.turnNumber}
            href={`#${t.anchorId}`}
            className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-700 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-800"
          >
            Turn {t.turnNumber}
          </a>
        ))}
      </div>

      {/* Main header / Conversation metadata */}
      <header className="mt-6 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm print:border-none print:p-0 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Conversation</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Conversation {report.sessionId}
            </h1>
          </div>
          <button
            onClick={() => copyToClipboard(report.sessionId, "session")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 print:hidden"
            title="คัดลอก Session ID"
          >
            {copiedId === "session" ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                <span>คัดลอกแล้ว</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                <span>คัดลอก ID</span>
              </>
            )}
          </button>
        </div>

        {/* Metadata key-value list matching user format */}
        <dl className="mt-6 grid grid-cols-1 gap-x-6 gap-y-4 border-t border-slate-100 pt-6 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs font-medium text-slate-500">Session</dt>
            <dd className="mt-1 break-all font-mono text-xs font-semibold text-slate-900">{report.sessionId}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Student</dt>
            <dd className="mt-1 font-mono text-xs font-medium text-slate-800">{report.student}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Knowledge base</dt>
            <dd className="mt-1 font-medium text-slate-800">{report.knowledgeBase}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Started</dt>
            <dd className="mt-1 font-mono text-xs text-slate-800">{report.startedAtUtc}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Turns</dt>
            <dd className="mt-1 font-mono text-xs font-semibold text-slate-900">{report.turnsCount}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Total time</dt>
            <dd className="mt-1 font-mono text-xs font-semibold text-slate-900">{report.formattedTotalTime}</dd>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <dt className="text-xs font-medium text-slate-500">Tokens</dt>
            <dd className="mt-1 font-mono text-xs text-slate-800">{report.tokens.formatted}</dd>
          </div>
        </dl>
      </header>

      {/* Time per step Summary Table */}
      <section className="mt-8 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm print:border-none print:p-0 print:shadow-none">
        <h2 className="text-lg font-bold tracking-tight text-slate-900">Time per step</h2>
        <p className="mt-1 text-xs text-slate-500">
          สถิติการใช้เวลาในแต่ละขั้นตอนตลอดทั้งบทสนทนา ({report.turnsCount} turns)
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="py-2.5 pl-3 pr-4 font-semibold">Step</th>
                <th className="px-3 py-2.5 text-right font-semibold">Turns</th>
                <th className="px-3 py-2.5 text-right font-semibold">Total</th>
                <th className="px-3 py-2.5 text-right font-semibold">Mean</th>
                <th className="px-3 py-2.5 text-right font-semibold">Max</th>
                <th className="py-2.5 pl-3 pr-4 text-right font-semibold">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-slate-800">
              {report.stepSummaries.map((s) => (
                <tr key={s.step} className="hover:bg-slate-50/70">
                  <td className="py-2.5 pl-3 pr-4 font-sans font-medium text-slate-900">{s.step}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{s.turns}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold">{s.totalFormatted}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{s.meanFormatted}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{s.maxFormatted}</td>
                  <td className="py-2.5 pl-3 pr-4 text-right tabular-nums">
                    <span
                      className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                        s.sharePercent >= 40
                          ? "bg-emerald-100 text-emerald-800"
                          : s.sharePercent >= 10
                          ? "bg-slate-100 text-slate-700"
                          : "text-slate-400"
                      }`}
                    >
                      {s.shareFormatted}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Turns Section */}
      <section className="mt-10 space-y-8">
        {report.turns.map((turn) => (
          <TurnArticle
            key={turn.turnNumber}
            turn={turn}
            copiedId={copiedId}
            copyToClipboard={copyToClipboard}
            forceExpand={expandAll}
          />
        ))}
      </section>
    </div>
  );
}

function TurnArticle({
  turn,
  copiedId,
  copyToClipboard,
  forceExpand
}: {
  turn: ReportTurn;
  copiedId: string | null;
  copyToClipboard: (text: string, id: string) => void;
  forceExpand: boolean;
}) {
  const [localOpen, setLocalOpen] = useState(false);
  const isDetailsOpen = forceExpand || localOpen;

  return (
    <article
      id={turn.anchorId}
      className="scroll-mt-14 break-inside-avoid rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm print:rounded-none print:border print:border-slate-300 print:p-5 print:shadow-none"
    >
      {/* Turn Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <a
            href={`#${turn.anchorId}`}
            className="text-base font-bold text-emerald-700 hover:underline"
          >
            Turn {turn.turnNumber}
          </a>
          <span className="font-mono text-xs text-slate-500">{turn.timestampUtc}</span>
        </div>
        <button
          onClick={() => copyToClipboard(window.location.href.split("#")[0] + `#${turn.anchorId}`, `link-${turn.turnNumber}`)}
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 print:hidden"
          title="คัดลอกลิงก์ไปยัง Turn นี้"
          aria-label={`คัดลอกลิงก์ Turn ${turn.turnNumber}`}
        >
          {copiedId === `link-${turn.turnNumber}` ? (
            <Check className="h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Messages dialogue */}
      <div className="mt-4 space-y-3">
        {/* User query */}
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">ผู้ใช้ (Student)</div>
          <p className="mt-1.5 whitespace-pre-wrap break-words font-sans text-sm leading-6 text-emerald-950 font-medium">
            {turn.userMessage}
          </p>
        </div>

        {/* Assistant reply */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600">ผู้ช่วย (StudyMate)</div>
          <p className="mt-1.5 whitespace-pre-wrap break-words font-sans text-sm leading-6 text-slate-900">
            {turn.assistantMessage}
          </p>
        </div>
      </div>

      {/* Pill summary strip matching user format */}
      <div className="mt-4 flex flex-wrap items-center gap-1.5 rounded-lg bg-slate-100/80 p-2 font-mono text-[11px] text-slate-700">
        {turn.pills.map((pill, idx) => (
          <span
            key={idx}
            className={`inline-block rounded px-2 py-0.5 ${
              pill.tone === "success"
                ? "bg-emerald-100 text-emerald-800"
                : pill.tone === "info"
                ? "bg-cyan-100 text-cyan-800"
                : pill.tone === "academic"
                ? "bg-purple-100 text-purple-800"
                : pill.tone === "warning"
                ? "bg-rose-100 text-rose-800"
                : "bg-white text-slate-800 shadow-2xs"
            }`}
          >
            {pill.label}
          </span>
        ))}
      </div>

      {/* Structured Turn Sections */}
      <div className="mt-5 space-y-4 text-xs">
        {/* Intent section */}
        <section className="rounded-xl border border-slate-200/70 p-3.5">
          <h3 className="font-bold text-slate-800">Intent</h3>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-[11px] sm:grid-cols-3">
            <div>
              <dt className="text-slate-500">intent</dt>
              <dd className="font-semibold text-slate-900">{turn.intent.intent}</dd>
            </div>
            <div>
              <dt className="text-slate-500">learner_state</dt>
              <dd className="text-slate-800">{turn.intent.learnerState}</dd>
            </div>
            <div>
              <dt className="text-slate-500">special_handling</dt>
              <dd className="truncate text-slate-800">
                {turn.intent.specialHandling ? JSON.stringify(turn.intent.specialHandling) : "none"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">confidence</dt>
              <dd className="text-slate-800">{turn.intent.confidence?.toFixed(2) ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">message_type</dt>
              <dd className="text-slate-800">{turn.intent.messageType}</dd>
            </div>
            <div>
              <dt className="text-slate-500">fallback_applied</dt>
              <dd className="text-slate-800">{turn.intent.fallbackApplied}</dd>
            </div>
            {turn.intent.routerReason && (
              <div className="col-span-2 sm:col-span-3 font-sans text-xs pt-1 border-t border-slate-100 mt-1">
                <dt className="text-slate-500">เหตุผลที่เลือกเส้นทาง (Router reason)</dt>
                <dd className="mt-0.5 text-slate-700">{turn.intent.routerReason}</dd>
              </div>
            )}
          </dl>
        </section>

        {/* Detected Concept (if present) */}
        <section className="rounded-xl border border-slate-200/70 p-3.5">
          <h3 className="font-bold text-slate-800">Detected Concept</h3>
          {turn.detectedConcept ? (
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-[11px] sm:grid-cols-4">
              <div>
                <dt className="text-slate-500">topic</dt>
                <dd className="text-slate-800">{turn.detectedConcept.topic ?? "(empty)"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">topic_th</dt>
                <dd className="text-slate-800">{turn.detectedConcept.topicTh ?? "null"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">node_id</dt>
                <dd className="text-slate-800">{turn.detectedConcept.nodeId ?? "null"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">student_level</dt>
                <dd className="text-slate-800">{turn.detectedConcept.studentLevel ?? "beginner"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">matched_by</dt>
                <dd className="text-slate-800">{turn.detectedConcept.matchedBy ?? "unmatched"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">level_source</dt>
                <dd className="text-slate-800">{turn.detectedConcept.levelSource ?? "default_beginner"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">confidence</dt>
                <dd className="text-slate-800">{turn.detectedConcept.confidence?.toFixed(2) ?? "0.00"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">ambiguous</dt>
                <dd className="text-slate-800">{turn.detectedConcept.ambiguous ?? "no"}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-1 font-mono text-[11px] text-slate-500">Not recorded</p>
          )}
        </section>

        {/* Retrieval */}
        <section className="rounded-xl border border-slate-200/70 p-3.5">
          <h3 className="font-bold text-slate-800">Retrieval</h3>
          <p className="mt-1 font-mono text-[11px] text-slate-700">{turn.retrieval.summary}</p>
          {turn.retrieval.sources.length > 0 && (
            <ul className="mt-2 space-y-1.5 border-t border-slate-100 pt-2 font-sans text-xs">
              {turn.retrieval.sources.map((src, i) => (
                <li key={i} className="flex items-center gap-1.5 break-all">
                  <span className="text-slate-400">•</span>
                  {/^https?:\/\//i.test(src) ? (
                    <a
                      href={src}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-emerald-700 underline hover:text-emerald-800"
                    >
                      {src}
                      <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                    </a>
                  ) : (
                    <span>{src}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Answer evaluation & Knowledge guidance */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <section className="rounded-xl border border-slate-200/70 p-3.5">
            <h3 className="font-bold text-slate-800">Answer evaluation</h3>
            <p className="mt-1 font-sans text-xs text-slate-600 leading-5">{turn.answerEvaluation}</p>
          </section>
          <section className="rounded-xl border border-slate-200/70 p-3.5">
            <h3 className="font-bold text-slate-800">Knowledge guidance</h3>
            <p className="mt-1 font-mono text-[11px] text-slate-500">{turn.knowledgeGuidance}</p>
          </section>
        </div>

        {/* Strategy & Teaching Policy (when recorded) */}
        {turn.strategy && (
          <section className="rounded-xl border border-slate-200/70 p-3.5">
            <h3 className="font-bold text-slate-800">Strategy</h3>
            <dl className="mt-2 grid grid-cols-1 gap-2 font-mono text-[11px] sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">primary_strategy</dt>
                <dd className="text-slate-800 font-semibold">{JSON.stringify(turn.strategy.primaryStrategy)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">supporting_strategies</dt>
                <dd className="text-slate-800">{JSON.stringify(turn.strategy.supportingStrategies)}</dd>
              </div>
              {turn.strategy.constraints && (
                <div className="sm:col-span-2">
                  <dt className="text-slate-500">constraints</dt>
                  <dd className="text-slate-800">{JSON.stringify(turn.strategy.constraints)}</dd>
                </div>
              )}
            </dl>
          </section>
        )}

        {turn.teachingPolicy && (
          <section className="rounded-xl border border-slate-200/70 p-3.5">
            <h3 className="font-bold text-slate-800">Teaching policy</h3>
            <dl className="mt-2 grid grid-cols-2 gap-2 font-mono text-[11px] sm:grid-cols-4">
              <div>
                <dt className="text-slate-500">row</dt>
                <dd className="text-slate-800 font-semibold">{turn.teachingPolicy.row}</dd>
              </div>
              <div>
                <dt className="text-slate-500">context</dt>
                <dd className="text-slate-800">{turn.teachingPolicy.context}</dd>
              </div>
              <div>
                <dt className="text-slate-500">direct_answer</dt>
                <dd className="text-slate-800">{turn.teachingPolicy.directAnswer}</dd>
              </div>
              <div>
                <dt className="text-slate-500">check</dt>
                <dd className="text-slate-800">{turn.teachingPolicy.check}</dd>
              </div>
              {turn.teachingPolicy.overrideNotes && (
                <div className="col-span-2 sm:col-span-4 font-sans text-xs text-slate-600 mt-1">
                  <dt className="text-slate-500 font-mono text-[11px]">override_notes</dt>
                  <dd className="mt-0.5">{JSON.stringify(turn.teachingPolicy.overrideNotes)}</dd>
                </div>
              )}
            </dl>
          </section>
        )}

        {/* Response plan */}
        {turn.responsePlan && (
          <section className="rounded-xl border border-slate-200/70 p-3.5">
            <h3 className="font-bold text-slate-800">Response plan</h3>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-[11px] sm:grid-cols-4">
              <div>
                <dt className="text-slate-500">mode</dt>
                <dd className="text-slate-800">{turn.responsePlan.mode}</dd>
              </div>
              <div>
                <dt className="text-slate-500">structure</dt>
                <dd className="text-slate-800">{JSON.stringify(turn.responsePlan.structure)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">max_words</dt>
                <dd className="text-slate-800">{turn.responsePlan.maxWords}</dd>
              </div>
              <div>
                <dt className="text-slate-500">max_questions</dt>
                <dd className="text-slate-800">{turn.responsePlan.maxQuestions}</dd>
              </div>
              <div>
                <dt className="text-slate-500">language_level</dt>
                <dd className="text-slate-800">{turn.responsePlan.languageLevel}</dd>
              </div>
              <div>
                <dt className="text-slate-500">language</dt>
                <dd className="text-slate-800">{turn.responsePlan.language}</dd>
              </div>
              <div>
                <dt className="text-slate-500">full_solution_allowed</dt>
                <dd className="text-slate-800">{turn.responsePlan.fullSolutionAllowed}</dd>
              </div>
              <div>
                <dt className="text-slate-500">wait_for_student</dt>
                <dd className="text-slate-800">{turn.responsePlan.waitForStudent}</dd>
              </div>
            </dl>
          </section>
        )}

        {/* Guardrail */}
        {turn.guardrail && (
          <section className="rounded-xl border border-slate-200/70 p-3.5">
            <h3 className="font-bold text-slate-800">Guardrail</h3>
            {turn.guardrail.detail && (
              <div className="mb-2 rounded bg-amber-50 p-2 font-sans text-xs text-amber-900 leading-5">
                <span className="font-semibold">Note: </span>
                {turn.guardrail.detail}
              </div>
            )}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-[11px] sm:grid-cols-4">
              <div>
                <dt className="text-slate-500">scanned</dt>
                <dd className="text-slate-800">{turn.guardrail.scanned}</dd>
              </div>
              <div>
                <dt className="text-slate-500">forms</dt>
                <dd className="text-slate-800">{turn.guardrail.forms}</dd>
              </div>
              <div>
                <dt className="text-slate-500">not_detected</dt>
                <dd className="text-slate-800">{turn.guardrail.notDetected}</dd>
              </div>
              <div>
                <dt className="text-slate-500">withheld_solution</dt>
                <dd className="text-slate-800">{turn.guardrail.withheldSolution}</dd>
              </div>
            </dl>
          </section>
        )}

        {/* Timings Table */}
        <section className="rounded-xl border border-slate-200/70 p-3.5">
          <h3 className="font-bold text-slate-800">Timings</h3>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left font-mono text-[11px]">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-1.5 pr-4 font-semibold">step</th>
                  <th className="px-4 py-1.5 font-semibold">label</th>
                  <th className="px-4 py-1.5 font-semibold">engine</th>
                  <th className="py-1.5 pl-4 text-right font-semibold">ms</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {turn.timings.map((tm, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-1.5 pr-4 text-slate-500">{tm.step}</td>
                    <td className="px-4 py-1.5 font-sans font-medium text-slate-900">{tm.label}</td>
                    <td className="px-4 py-1.5">
                      <span
                        className={`inline-block rounded px-1.5 py-0.2 text-[10px] ${
                          tm.engine === "llm"
                            ? "bg-purple-100 text-purple-800"
                            : tm.engine === "data"
                            ? "bg-cyan-100 text-cyan-800"
                            : tm.engine === "policy"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {tm.engine}
                      </span>
                    </td>
                    <td className="py-1.5 pl-4 text-right tabular-nums font-semibold">
                      {tm.ms.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Token usage */}
        {turn.tokenUsage && (
          <section className="rounded-xl border border-slate-200/70 p-3.5">
            <h3 className="font-bold text-slate-800">Token usage</h3>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px] sm:grid-cols-3">
              <div>
                <dt className="text-slate-500">generation</dt>
                <dd className="text-slate-800">
                  {JSON.stringify({ input: turn.tokenUsage.input ?? 0, output: turn.tokenUsage.output ?? 0 })}
                </dd>
              </div>
            </dl>
          </section>
        )}

        {/* Versions */}
        {turn.versions && (
          <section className="rounded-xl border border-slate-200/70 p-3.5">
            <h3 className="font-bold text-slate-800">Versions</h3>
            <dl className="mt-2 space-y-1 font-mono text-[11px]">
              {turn.versions.models && (
                <div>
                  <dt className="inline text-slate-500">models: </dt>
                  <dd className="inline text-slate-800">{JSON.stringify(turn.versions.models)}</dd>
                </div>
              )}
              {turn.versions.tables && (
                <div>
                  <dt className="inline text-slate-500">tables: </dt>
                  <dd className="inline break-all text-slate-800">{JSON.stringify(turn.versions.tables)}</dd>
                </div>
              )}
              {turn.versions.prompts && (
                <div>
                  <dt className="inline text-slate-500">prompts: </dt>
                  <dd className="inline text-slate-800">{JSON.stringify(turn.versions.prompts)}</dd>
                </div>
              )}
            </dl>
          </section>
        )}

        {/* Raw Decision Trace (JSON) */}
        <details
          open={isDetailsOpen}
          onToggle={(e) => setLocalOpen(e.currentTarget.open)}
          className="group rounded-xl border border-slate-200/80 bg-slate-50 p-3 print:hidden"
        >
          <summary className="flex cursor-pointer select-none items-center justify-between text-xs font-bold text-slate-700 hover:text-emerald-700">
            <span>Raw Decision Trace (JSON)</span>
            <ChevronDown className="h-4 w-4 text-slate-400 transition group-open:rotate-180" aria-hidden="true" />
          </summary>
          <pre className="mt-3 max-h-96 overflow-x-auto rounded-lg border border-slate-200 bg-white p-3 font-mono text-[11px] leading-5 text-slate-800">
            {JSON.stringify(turn.rawTrace, null, 2)}
          </pre>
        </details>
      </div>
    </article>
  );
}
