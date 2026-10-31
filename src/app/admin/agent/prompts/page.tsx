"use client";

import { useState } from "react";
import { Save, CheckCircle } from "lucide-react";

export default function PromptsGuardrailsPage() {
  const [activeTab, setActiveTab] = useState<"PROMPTS" | "GUARDRAILS" | "ROUTING">("PROMPTS");
  const [saved, setSaved] = useState(false);

  const [systemPrompt, setSystemPrompt] = useState(
`คุณคือ BU StudyMate ผู้ช่วยอัจฉริยะสำหรับนักศึกษามหาวิทยาลัยกรุงเทพ (Bangkok University)
บุคลิก: สุภาพ เป็นกันเอง มีความกระตือรือร้น ใช้สรรพนามที่อบอุ่นและเข้าใจง่าย

กฎเหล็ก (Strict Rules):
1. อ้างอิงข้อมูลจากคลังความรู้ BU Knowledge Base เท่านั้น หากไม่มีข้อมูลให้ระบุอย่างตรงไปตรงมา และแนะนำช่องทางติดต่อมหาวิทยาลัย (เช่น แผนกทะเบียน, แผนกการเงิน)
2. ห้ามแต่งเติมหรือคาดเดาข้อมูลกฎระเบียบ ค่าธรรมเนียม หรือวันสอบ (Anti-Hallucination)
3. สำหรับเรื่องร้องเรียนหรือปัญหาอุปกรณ์ห้องเรียน ให้แนะนำระบบ Ticket Reporting เสมอ
4. ใช้ภาษาไทยเป็นหลัก เว้นแต่ผู้ใช้สื่อสารด้วยภาษาอังกฤษ ให้ตอบด้วยภาษาอังกฤษอย่างถูกต้องและสุภาพ`
  );

  const guardrails = [
    {
      id: "anti-hallucination",
      title: "Anti-Hallucination Threshold",
      desc: "บังคับให้อ้างอิงเฉพาะ Chunks ที่มี Cosine Similarity > 0.65 หากต่ำกว่า ให้ตอบว่าไม่มีข้อมูลและแนะนำลิงก์ทางการ",
      enabled: true,
      severity: "STRICT"
    },
    {
      id: "pii-masking",
      title: "Student PII Protection",
      desc: "ตรวจจับและปกปิดหมายเลขบัตรประชาชน, รหัสผ่าน, เบอร์โทรศัพท์ส่วนตัว ก่อนส่งให้โมเดลภายนอก",
      enabled: true,
      severity: "CRITICAL"
    },
    {
      id: "out-of-scope",
      title: "Off-Topic Deflection",
      desc: "จำกัดขอบเขตการตอบให้อยู่ในบริบทของมหาวิทยาลัยกรุงเทพ และการเรียน หากถามเรื่องการเมืองหรือเรื่องนอกกรอบ ให้ปฏิเสธอย่างสุภาพ",
      enabled: true,
      severity: "NORMAL"
    },
    {
      id: "emergency-escalate",
      title: "Emergency Keyword Escalation",
      desc: "ตรวจจับคีย์เวิร์ดฉุกเฉิน (ไฟไหม้, ควัน, ลิฟต์ค้าง, อุบัติเหตุ) และตัดเข้าสู่ Handover ทันที",
      enabled: true,
      severity: "CRITICAL"
    }
  ];

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <main className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-bu-ink sm:text-3xl">Prompts & Guardrails</h1>
          <p className="mt-1 text-sm text-slate-600">จัดการ System Prompts นโยบายความปลอดภัย และการตั้งค่า Guardrails ของ AI Agent</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-800 transition"
          >
            {saved ? <CheckCircle className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {saved ? "บันทึกเรียบร้อย (Mock Saved)" : "บันทึกการเปลี่ยนแปลง"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab("PROMPTS")}
          className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
            activeTab === "PROMPTS" ? "bg-emerald-100/80 text-emerald-800" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          System Prompt Template
        </button>
        <button
          onClick={() => setActiveTab("GUARDRAILS")}
          className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
            activeTab === "GUARDRAILS" ? "bg-emerald-100/80 text-emerald-800" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          Safety & Guardrails
        </button>
        <button
          onClick={() => setActiveTab("ROUTING")}
          className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
            activeTab === "ROUTING" ? "bg-emerald-100/80 text-emerald-800" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          Intent Routing Thresholds
        </button>
      </div>

      {/* Tab 1: System Prompt */}
      {activeTab === "PROMPTS" && (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-bu-ink">Core System Prompt</h2>
              <p className="text-xs text-slate-500">คำสั่งหลักที่ส่งไปยัง LLM ในทุกรอบการสนทนาของ StudyMate Agent</p>
            </div>
            <span className="rounded bg-emerald-50 px-2.5 py-1 text-xs font-mono font-semibold text-emerald-700">
              Active: v2.4.1
            </span>
          </div>

          <div className="relative">
            <textarea
              rows={12}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 p-4 font-mono text-xs leading-relaxed text-slate-800 outline-none focus:border-emerald-600 focus:bg-white focus:ring-1 focus:ring-emerald-600"
            />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>ตัวแปรที่รองรับ: <code className="rounded bg-slate-100 px-1 py-0.5">{"{{student_name}}"}</code>, <code className="rounded bg-slate-100 px-1 py-0.5">{"{{faculty}}"}</code>, <code className="rounded bg-slate-100 px-1 py-0.5">{"{{rag_context}}"}</code></span>
            <span>ความยาว: {systemPrompt.length} ตัวอักษร</span>
          </div>
        </section>
      )}

      {/* Tab 2: Guardrails */}
      {activeTab === "GUARDRAILS" && (
        <section className="space-y-4">
          <div className="grid gap-4">
            {guardrails.map((g) => (
              <div key={g.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">{g.title}</span>
                    <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                      g.severity === "CRITICAL" ? "bg-rose-100 text-rose-800" : g.severity === "STRICT" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"
                    }`}>
                      {g.severity}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{g.desc}</p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-semibold text-emerald-700">Active</span>
                  <div className="h-5 w-9 rounded-full bg-emerald-600 p-0.5 cursor-pointer">
                    <div className="h-4 w-4 rounded-full bg-white shadow-sm ml-4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Tab 3: Routing */}
      {activeTab === "ROUTING" && (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-bu-ink">Semantic Intent Routing Configuration</h2>
          <p className="text-xs text-slate-500">เกณฑ์การตัดสินใจจำแนก Intent ของผู้ใช้</p>

          <div className="space-y-4 divide-y divide-slate-100">
            <div className="pt-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-800">Knowledge RAG (Campus Q&A)</p>
                <p className="text-xs text-slate-500">คำถามเกี่ยวกับหลักสูตร ทุน หอพัก กิจกรรม กฎระเบียบ</p>
              </div>
              <span className="rounded bg-slate-100 px-3 py-1 font-mono text-xs font-semibold">Min Confidence: 0.72</span>
            </div>

            <div className="pt-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-800">Support Ticket Flow (Issue Reporting)</p>
                <p className="text-xs text-slate-500">แจ้งปัญหาห้องเรียน แอร์ไม่เย็น ไฟดับ จอดับ ชำรุด</p>
              </div>
              <span className="rounded bg-slate-100 px-3 py-1 font-mono text-xs font-semibold">Min Confidence: 0.80</span>
            </div>

            <div className="pt-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-800">Study Tutor & Material Upload</p>
                <p className="text-xs text-slate-500">ติวสรุปเนื้อหา แบบฝึกหัด อัปโหลดเอกสาร PDF/Docx</p>
              </div>
              <span className="rounded bg-slate-100 px-3 py-1 font-mono text-xs font-semibold">Min Confidence: 0.68</span>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
