"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  Headphones, 
  Clock, 
  AlertTriangle, 
  UserCheck, 
  CheckCircle2
} from "lucide-react";

interface HandoverItem {
  id: string;
  studentName: string;
  lineUserId: string;
  reason: string;
  intent: string;
  waitingMinutes: number;
  priority: "HIGH" | "NORMAL" | "LOW";
  lastMessage: string;
}

const mockQueue: HandoverItem[] = [
  {
    id: "ho-101",
    studentName: "Thanawat P. (วิศวกรรมศาสตร์)",
    lineUserId: "Ub842de9210...",
    reason: "รายงานเหตุด่วนอุปกรณ์มีควัน / กลัวไฟไหม้",
    intent: "ticket_flow",
    waitingMinutes: 8,
    priority: "HIGH",
    lastMessage: "อาจารย์จะเริ่มสอนแล้วครับ มีเจ้าหน้าที่มาดูให้ได้ไหมครับ มีกลิ่นไหม้"
  },
  {
    id: "ho-102",
    studentName: "Kittikorn S. (บริหารธุรกิจ)",
    lineUserId: "Uc119ad3321...",
    reason: "บอทตอบคำถามไม่ตรง 3 ครั้งติด (Low Confidence)",
    intent: "knowledge_rag",
    waitingMinutes: 14,
    priority: "NORMAL",
    lastMessage: "ไม่ใช่ครับ ผมหมายถึงเกณฑ์การเทียบโอนรายวิชาจาก ม.เดิม ไม่ใช่การลงทะเบียนล่าช้า"
  },
  {
    id: "ho-103",
    studentName: "Pimchanok L. (นิเทศศาสตร์)",
    lineUserId: "Ue5541098ef...",
    reason: "ผู้ใช้พิมพ์ขอคุยกับเจ้าหน้าที่ (Explicit Request)",
    intent: "concise_chat",
    waitingMinutes: 22,
    priority: "NORMAL",
    lastMessage: "ขอคุยกับแอดมินหน่อยค่ะ เอกสารใบรับรองสภาพนักศึกษามีปัญหาด่วน"
  }
];

export default function HandoverQueuePage() {
  const [queue, setQueue] = useState<HandoverItem[]>(mockQueue);

  const handleClaim = (id: string) => {
    alert(`รับเคส ${id} เข้าดูแลแล้ว ระบบกำลังเชื่อมต่อคุณเข้าสู่ Live Chat`);
    setQueue(queue.filter((q) => q.id !== id));
  };

  return (
    <main className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-bu-ink sm:text-3xl">Handover Queue</h1>
          <p className="mt-1 text-sm text-slate-600">คิวคำร้องส่งต่อให้เจ้าหน้าที่มนุษย์ดูแลต่อจาก AI Agent</p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/conversations"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
          >
            เปิด Live Inbox
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">เคสที่รอดำเนินการในคิว</span>
            <div className="rounded-lg bg-amber-50 p-2 text-amber-700">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-3xl font-bold text-bu-ink">{queue.length}</div>
          <p className="mt-1 text-xs text-amber-700 font-medium">รอการตอบรับจากเจ้าหน้าที่</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">เวลารอเฉลี่ย (Avg Wait Time)</span>
            <div className="rounded-lg bg-cyan-50 p-2 text-cyan-700">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-3xl font-bold text-bu-ink">14.6 นาที</div>
          <p className="mt-1 text-xs text-slate-500">เป้าหมาย SLA: ต่ำกว่า 10 นาที</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">ส่งต่อสำเร็จวันนี้</span>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
              <UserCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-3xl font-bold text-bu-ink">18 เคส</div>
          <p className="mt-1 text-xs text-emerald-600 font-medium">แก้ไขปัญหาและปิดเคสแล้ว 100%</p>
        </div>
      </div>

      {/* Queue Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-bu-ink">รายการคำร้องในคิวปัจจุบัน</h2>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {queue.length} รายการ
          </span>
        </div>

        {queue.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
            <h3 className="mt-3 text-sm font-semibold text-slate-800">ไม่มีเคสค้างในคิว</h3>
            <p className="mt-1 text-xs text-slate-500">เจ้าหน้าที่ได้รับเคสทั้งหมดเรียบร้อยแล้ว</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {queue.map((item) => (
              <div key={item.id} className="p-5 hover:bg-slate-50/70 transition flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">{item.studentName}</span>
                    <span className="text-xs font-mono text-slate-400">({item.lineUserId})</span>
                    {item.priority === "HIGH" ? (
                      <span className="rounded bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-800">
                        ด่วนมาก (High)
                      </span>
                    ) : (
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                        ปกติ (Normal)
                      </span>
                    )}
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-mono text-slate-600">
                      {item.intent}
                    </span>
                  </div>

                  <p className="text-xs text-amber-900 font-medium flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                    <span>เหตุผลที่ส่งต่อ: {item.reason}</span>
                  </p>

                  <p className="text-xs text-slate-600 bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                    &quot;{item.lastMessage}&quot;
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-700">{item.waitingMinutes} นาที</div>
                    <div className="text-[10px] text-slate-400">เวลารอ</div>
                  </div>

                  <button
                    onClick={() => handleClaim(item.id)}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-800 shadow-sm"
                  >
                    <Headphones className="h-4 w-4" />
                    รับเคสนี้
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
