"use client";

import { useState } from "react";
import { Wrench } from "lucide-react";

interface AgentTool {
  id: string;
  name: string;
  description: string;
  parameters: string;
  category: "RAG" | "ACTION" | "SEARCH" | "AUTH";
  status: "ACTIVE" | "DISABLED";
  calls: string;
  avgLatency: string;
}

const mockTools: AgentTool[] = [
  {
    id: "tool-rag",
    name: "bu_knowledge_rag",
    description: "ค้นหาข้อมูลมหาวิทยาลัยกรุงเทพจากฐานข้อมูลเวกเตอร์ (pgvector) ครอบคลุมกฎระเบียบ ทุนการศึกษา การลงทะเบียน และบริการนักศึกษา",
    parameters: '{\n  "query": "string (คำค้นหา)",\n  "category": "string (หมวดหมู่เสริม)",\n  "topK": "number (ค่าเริ่มต้น 5)"\n}',
    category: "RAG",
    status: "ACTIVE",
    calls: "2,480 ครั้ง",
    avgLatency: "215ms"
  },
  {
    id: "tool-ticket",
    name: "create_classroom_ticket",
    description: "สร้างตั๋วแจ้งซ่อมและรายงานปัญหาห้องเรียนอัตโนมัติ ส่งต่อไปยังช่างเทคนิคประจำอาคาร",
    parameters: '{\n  "location": "string (เช่น ตึก 4, อาคาร A3)",\n  "room": "string (เช่น 402, B301)",\n  "description": "string (รายละเอียดปัญหา)"\n}',
    category: "ACTION",
    status: "ACTIVE",
    calls: "184 ครั้ง",
    avgLatency: "140ms"
  },
  {
    id: "tool-study",
    name: "study_notebook_save",
    description: "บันทึกและจัดระเบียบเนื้อหาติวหรือสรุปรายวิชาลงในสมุดบันทึกส่วนตัวของนักศึกษา",
    parameters: '{\n  "notebookName": "string",\n  "subject": "string",\n  "content": "string"\n}',
    category: "ACTION",
    status: "ACTIVE",
    calls: "612 ครั้ง",
    avgLatency: "95ms"
  },
  {
    id: "tool-bulinks",
    name: "bulinks_live_lookup",
    description: "ดึงลิงก์และบริการทางการของมหาวิทยาลัยกรุงเทพแบบสดจาก bulinks.bu.ac.th",
    parameters: '{\n  "keyword": "string (คำค้นหา เช่น URSA, E-Payment)"\n}',
    category: "SEARCH",
    status: "ACTIVE",
    calls: "940 ครั้ง",
    avgLatency: "380ms"
  },
  {
    id: "tool-verify",
    name: "verify_bumail_student",
    description: "ตรวจสอบและผูกบัญชี @bumail.net ของนักศึกษาเข้ากับ LINE UID ผ่านระบบยืนยันตัวตน",
    parameters: '{\n  "email": "string",\n  "otp": "string (ถ้ามี)"\n}',
    category: "AUTH",
    status: "ACTIVE",
    calls: "320 ครั้ง",
    avgLatency: "110ms"
  }
];

export default function ToolsFunctionsPage() {
  const [tools, setTools] = useState<AgentTool[]>(mockTools);

  const toggleTool = (id: string) => {
    setTools(
      tools.map((t) => (t.id === id ? { ...t, status: t.status === "ACTIVE" ? "DISABLED" : "ACTIVE" } : t))
    );
  };

  return (
    <main className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-bu-ink sm:text-3xl">Tools & Custom Functions</h1>
          <p className="mt-1 text-sm text-slate-600">เครื่องมือและฟังก์ชันเสริมที่ AI Agent สามารถเลือกเรียกใช้ได้ตามบริบทของผู้ใช้</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm">
            ลงทะเบียนแล้ว {tools.length} ฟังก์ชัน
          </div>
        </div>
      </div>

      {/* Tools List */}
      <div className="grid gap-4">
        {tools.map((tool) => (
          <div
            key={tool.id}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300"
          >
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                    <Wrench className="h-4 w-4" />
                  </span>
                  <h3 className="font-mono text-sm font-bold text-slate-900">{tool.name}</h3>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                    {tool.category}
                  </span>
                  {tool.status === "ACTIVE" ? (
                    <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                      Active
                    </span>
                  ) : (
                    <span className="rounded bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                      Disabled
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">{tool.description}</p>

                {/* Schema code snippet */}
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer font-medium text-emerald-700 hover:underline">
                    ดูพารามิเตอร์ (JSON Schema)
                  </summary>
                  <pre className="mt-2 rounded-lg bg-slate-900 p-3 font-mono text-[11px] text-emerald-400 overflow-x-auto">
                    {tool.parameters}
                  </pre>
                </details>
              </div>

              {/* Stats & Toggle */}
              <div className="flex items-center gap-6 md:border-l md:border-slate-100 md:pl-6 shrink-0">
                <div className="text-right space-y-1">
                  <div className="text-xs font-bold text-slate-800">{tool.calls}</div>
                  <div className="text-[10px] text-slate-400">เฉลี่ย {tool.avgLatency}</div>
                </div>

                <button
                  onClick={() => toggleTool(tool.id)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    tool.status === "ACTIVE"
                      ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      : "bg-emerald-700 text-white hover:bg-emerald-800"
                  }`}
                >
                  {tool.status === "ACTIVE" ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
