"use client";

import { useState } from "react";
import { ScrollText } from "lucide-react";

interface LogEntry {
  id: string;
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR";
  source: "LINE_WEBHOOK" | "WEB_CHAT" | "RAG_SEARCH" | "LLM_API";
  message: string;
  statusCode: number;
  latencyMs: number;
}

const mockLogs: LogEntry[] = [
  {
    id: "log-1",
    timestamp: "23:35:12",
    level: "INFO",
    source: "LINE_WEBHOOK",
    message: "POST /api/line - Handled event: message (Text) from Ua938fe71...",
    statusCode: 200,
    latencyMs: 340
  },
  {
    id: "log-2",
    timestamp: "23:32:05",
    level: "WARN",
    source: "RAG_SEARCH",
    message: "RAG lookup similarity below threshold (0.58 < 0.65) for query: 'ขอเบอร์โทรนายกสโมฯ'",
    statusCode: 200,
    latencyMs: 180
  },
  {
    id: "log-3",
    timestamp: "23:28:44",
    level: "INFO",
    source: "LINE_WEBHOOK",
    message: "POST /api/line - Handled event: postback (RichMenu zone 1)",
    statusCode: 200,
    latencyMs: 95
  },
  {
    id: "log-4",
    timestamp: "23:15:20",
    level: "ERROR",
    source: "LLM_API",
    message: "RateLimitError: 429 Too Many Requests from OpenAI upstream API, auto-retried with backoff",
    statusCode: 429,
    latencyMs: 1420
  },
  {
    id: "log-5",
    timestamp: "23:02:18",
    level: "INFO",
    source: "WEB_CHAT",
    message: "POST /api/chat - Stream completed (SSE tokens: 312)",
    statusCode: 200,
    latencyMs: 780
  }
];

export default function LogsPage() {
  const [filterLevel, setFilterLevel] = useState<"ALL" | "INFO" | "WARN" | "ERROR">("ALL");

  const filteredLogs = mockLogs.filter((l) => (filterLevel === "ALL" ? true : l.level === filterLevel));

  return (
    <main className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-bu-ink sm:text-3xl">Webhook & Error Logs</h1>
          <p className="mt-1 text-sm text-slate-600">บันทึกเหตุการณ์รับส่ง Webhook ของ LINE และ Log ข้อผิดพลาดของระบบเรียลไทม์</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1 text-xs">
            {(["ALL", "INFO", "WARN", "ERROR"] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setFilterLevel(lvl)}
                className={`rounded px-2.5 py-1 font-semibold transition ${
                  filterLevel === lvl ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-bu-ink flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-emerald-600" />
            รายการ Log ล่าสุด ({filteredLogs.length} รายการ)
          </h2>
          <span className="text-xs text-slate-400">อัปเดตแบบ Realtime (Mock)</span>
        </div>

        <div className="divide-y divide-slate-100 font-mono text-xs">
          {filteredLogs.map((log) => (
            <div key={log.id} className="p-4 hover:bg-slate-50/70 transition flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">{log.timestamp}</span>
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                      log.level === "ERROR"
                        ? "bg-rose-100 text-rose-800"
                        : log.level === "WARN"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {log.level}
                  </span>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 font-medium">
                    {log.source}
                  </span>
                </div>

                <p className="text-slate-800 font-sans text-xs break-all">{log.message}</p>
              </div>

              <div className="flex items-center gap-4 shrink-0 text-right">
                <div>
                  <span
                    className={`font-bold ${
                      log.statusCode >= 400 ? "text-rose-600" : "text-emerald-700"
                    }`}
                  >
                    HTTP {log.statusCode}
                  </span>
                  <span className="ml-2 text-slate-400 text-[11px]">{log.latencyMs}ms</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
