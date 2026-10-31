"use client";

import { useState } from "react";
import { Megaphone, Send, CheckCircle2, Sparkles } from "lucide-react";

export default function BroadcastMessagesPage() {
  const [target, setTarget] = useState("ALL");
  const [message, setMessage] = useState("📢 ประกาศกำหนดการยื่นขอผ่อนผันค่าธรรมเนียมการศึกษา ภาคเรียนที่ 1/2569 สิ้นสุดวันที่ 15 พ.ย. นี้ นักศึกษาสามารถตรวจสอบเอกสารได้ทางระบบ URSA");
  const [sending, setSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  const pastCampaigns = [
    {
      id: "bc-1",
      title: "แจ้งเปิดใช้งานระบบ BU StudyMate AI เวอร์ชันใหม่",
      date: "20 ต.ค. 2026",
      target: "นักศึกษาทุกคน (All Followers)",
      recipients: 1840,
      openRate: "89.4%",
      status: "SENT"
    },
    {
      id: "bc-2",
      title: "แจ้งปิดปรับปรุงเซิร์ฟเวอร์ระบบลงทะเบียนเรียน",
      date: "15 ต.ค. 2026",
      target: "นักศึกษายืนยันตัวตนแล้ว (Verified)",
      recipients: 1120,
      openRate: "94.2%",
      status: "SENT"
    }
  ];

  const handleSend = () => {
    setSending(true);
    setTimeout(() => {
      setSending(false);
      setSentSuccess(true);
      setTimeout(() => setSentSuccess(false), 3000);
    }, 1200);
  };

  return (
    <main className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="mt-1 text-2xl font-bold text-bu-ink sm:text-3xl">Broadcast Messages</h1>
          <p className="mt-1 text-sm text-slate-600">ส่งข้อความบรอดแคสต์ ข่าวสาร และประกาศสำคัญไปยังนักศึกษาผ่าน LINE Official Account</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSend}
            disabled={sending || !message.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-800 transition disabled:opacity-60"
          >
            {sentSuccess ? <CheckCircle2 className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            {sending ? "กำลังส่งบรอดแคสต์..." : sentSuccess ? "ส่งข้อความสำเร็จ (Mock)" : "ส่งบรอดแคสต์ทันที"}
          </button>
        </div>
      </div>

      {/* Grid: Composer & History */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Composer */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-base font-semibold text-bu-ink flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-emerald-600" />
              สร้างข้อความบรอดแคสต์ใหม่
            </h2>

            {/* Target Audience */}
            <div>
              <label className="block text-xs font-semibold text-slate-700">กลุ่มเป้าหมาย (Audience Target)</label>
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
              >
                <option value="ALL">นักศึกษาทุกคนที่ติดตาม LINE OA (1,840 คน)</option>
                <option value="VERIFIED">นักศึกษาที่ยืนยันบัญชี @bumail.net แล้ว (1,215 คน)</option>
                <option value="ENGINEERING">คณะวิศวกรรมศาสตร์ (310 คน)</option>
                <option value="BUSINESS">คณะบริหารธุรกิจ (420 คน)</option>
                <option value="COMMUNICATION">คณะนิเทศศาสตร์ (280 คน)</option>
              </select>
            </div>

            {/* Message Text */}
            <div>
              <label className="block text-xs font-semibold text-slate-700">เนื้อหาข้อความ</label>
              <textarea
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="พิมพ์ข้อความที่ต้องการประกาศ..."
                className="mt-1.5 w-full rounded-lg border border-slate-200 p-3 text-xs leading-relaxed text-slate-800 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
              />
              <span className="mt-1 block text-right text-[11px] text-slate-400">
                {message.length} / 500 ตัวอักษร
              </span>
            </div>
          </div>
        </div>

        {/* Live Preview Bubble */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-bu-ink flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-600" />
              ตัวอย่างข้อความบน LINE
            </h2>

            <div className="mt-4 rounded-xl bg-[#748899] p-4 shadow-inner">
              <div className="flex items-start gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-700 text-white font-bold text-xs shrink-0">
                  BU
                </div>
                <div>
                  <span className="text-[11px] text-white/90 font-medium">StudyMate</span>
                  <div className="mt-1 max-w-[240px] rounded-2xl rounded-tl-xs bg-white p-3 text-xs leading-relaxed text-slate-800 shadow">
                    {message || "ไม่มีเนื้อหาข้อความ"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-base font-semibold text-bu-ink">ประวัติการส่งบรอดแคสต์ที่ผ่านมา</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-slate-50 uppercase tracking-wide text-slate-500 font-semibold">
              <tr>
                <th className="px-6 py-3">หัวข้อประกาศ</th>
                <th className="px-6 py-3">กลุ่มเป้าหมาย</th>
                <th className="px-6 py-3">จำนวนผู้รับ</th>
                <th className="px-6 py-3">อัตราการเปิดอ่าน</th>
                <th className="px-6 py-3">วันที่ส่ง</th>
                <th className="px-6 py-3">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pastCampaigns.map((camp) => (
                <tr key={camp.id} className="hover:bg-slate-50/70">
                  <td className="px-6 py-4 font-semibold text-slate-800">{camp.title}</td>
                  <td className="px-6 py-4 text-slate-600">{camp.target}</td>
                  <td className="px-6 py-4 font-mono font-medium">{camp.recipients.toLocaleString()} คน</td>
                  <td className="px-6 py-4 text-emerald-700 font-bold">{camp.openRate}</td>
                  <td className="px-6 py-4 text-slate-500">{camp.date}</td>
                  <td className="px-6 py-4">
                    <span className="rounded bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                      สำเร็จ
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
