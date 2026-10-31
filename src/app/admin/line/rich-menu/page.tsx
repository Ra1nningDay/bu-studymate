"use client";

import { useState } from "react";
import { Upload, CheckCircle2, RefreshCw, Smartphone } from "lucide-react";

export default function RichMenuStudioPage() {
  const [deploying, setDeploying] = useState(false);
  const [deployed, setDeployed] = useState(false);

  const zones = [
    { title: "ถามตอบข้อมูล BU", action: "text: ถามข้อมูลมหาวิทยาลัยกรุงเทพ", color: "bg-emerald-500/10 border-emerald-400" },
    { title: "สรุปเนื้อหา / ช่วยติว", action: "text: ช่วยติวเนื้อหาวิชาเรียน", color: "bg-cyan-500/10 border-cyan-400" },
    { title: "แจ้งปัญหาห้องเรียน", action: "text: แจ้งปัญหาห้องเรียนและอุปกรณ์", color: "bg-amber-500/10 border-amber-400" },
    { title: "สมุดโน้ตของฉัน", action: "text: เปิดสมุดโน้ตของฉัน", color: "bg-purple-500/10 border-purple-400" },
    { title: "บริการ & ลิงก์ด่วน (BU Links)", action: "uri: https://bulinks.bu.ac.th", color: "bg-blue-500/10 border-blue-400" },
    { title: "โปรไฟล์ & ยืนยันตัวตน", action: "text: ตรวจสอบสถานะบัญชีนักศึกษา", color: "bg-rose-500/10 border-rose-400" }
  ];

  const handleDeploy = () => {
    setDeploying(true);
    setTimeout(() => {
      setDeploying(false);
      setDeployed(true);
      setTimeout(() => setDeployed(false), 3000);
    }, 1200);
  };

  return (
    <main className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-bu-ink sm:text-3xl">Rich Menu Studio</h1>
          <p className="mt-1 text-sm text-slate-600">จัดการเมนูลัด (Rich Menu) 6 ช่องสำหรับห้องแชท LINE Official Account ของ StudyMate</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDeploy}
            disabled={deploying}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-800 transition disabled:opacity-60"
          >
            {deploying ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : deployed ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {deploying ? "กำลังส่งไปยัง LINE..." : deployed ? "อัปเดตเรียบร้อย!" : "Deploy ไปยัง LINE OA"}
          </button>
        </div>
      </div>

      {/* Rich Menu Canvas & Details */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: Visual Phone Canvas Preview */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <h2 className="text-base font-semibold text-bu-ink flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-emerald-600" />
              ภาพจำลอง Rich Menu (2500 x 1686 px)
            </h2>
            <span className="rounded bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
              Active เมนูเริ่มต้น
            </span>
          </div>

          <div className="mt-5 rounded-xl border-2 border-dashed border-slate-300 bg-slate-900 p-4 text-white">
            <div className="grid grid-cols-3 gap-3 aspect-[25/16.86]">
              {zones.map((zone, idx) => (
                <div
                  key={idx}
                  className={`rounded-lg border-2 ${zone.color} p-3 flex flex-col justify-between hover:bg-white/10 transition cursor-pointer`}
                >
                  <span className="text-[10px] font-mono text-slate-300">Zone {idx + 1}</span>
                  <div className="text-center my-auto">
                    <p className="text-xs font-bold text-white leading-tight">{zone.title}</p>
                    <p className="mt-1 text-[9px] text-slate-300 truncate">{zone.action}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-3 text-center text-xs text-slate-400">
            คลิกที่แต่ละช่องด้านบนเพื่อกำหนด Action, Postback data หรือเปิด WebView
          </p>
        </div>

        {/* Right: Zone Configuration */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-bu-ink">ข้อมูลเมนูปัจจุบัน</h2>
            <dl className="mt-4 space-y-3 text-xs">
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <dt className="text-slate-500">Rich Menu ID</dt>
                <dd className="font-mono text-slate-800">richmenu-b4850fa104f2...</dd>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <dt className="text-slate-500">ขนาดภาพ</dt>
                <dd className="text-slate-800 font-medium">2500 x 1686 px (Large)</dd>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <dt className="text-slate-500">Chat Bar Text</dt>
                <dd className="text-slate-800 font-medium">เปิดเมนูบริการ StudyMate 🚀</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">อัปเดตล่าสุด</dt>
                <dd className="text-slate-800">24 ต.ค. 2026</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-bu-ink">คำสั่ง CLI ที่เกี่ยวข้อง</h2>
            <p className="mt-1 text-xs text-slate-500">สามารถสร้างและอัปโหลดภาพผ่านคำสั่ง npm ได้เช่นกัน</p>
            <div className="mt-3 rounded-lg bg-slate-900 p-3 font-mono text-xs text-emerald-400">
              pnpm line:richmenu:upload
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
