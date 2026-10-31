# BU StudyMate: LLM Evaluation with Promptfoo

โฟลเดอร์นี้รวบรวมการตั้งค่าและชุดคำถามสำหรับทำ **Automated LLM Evaluation, Benchmark และ Regression Testing** ด้วย [Promptfoo](https://promptfoo.dev/)

Source ownership: [chat execution map](../src/services/chat/README.md),
[orchestrator](../src/services/chat/chat-orchestration.service.ts),
[classifier](../src/lib/router/agent-router.ts), and
[task-specific AI exports](../src/lib/ai/index.ts). Offline chat regressions live
in `src/services/chat/`; the provider configs below can make real model calls.

## P1 production knowledge candidate baseline

`pnpm eval:p1` รันคำถามตัวอย่าง 40 เคสจาก 8 หมวด P1 (Finance, Registrar,
Calendar, Scholarship, Admission, IT, Welfare, Support) ผ่าน
`ChatOrchestrationService.createBotReply()` จริง โดยใช้ session, ticket และ chat log
แบบ in-memory แยกในแต่ละเคส จึงไม่สร้าง ticket หรือเขียนประวัติแชตลงฐานข้อมูล
Knowledge Base ยังอ่านจากฐานข้อมูลตาม `DATABASE_URL` และคำถามที่ต้องใช้ข้อมูลสด
ยังเรียก web search จริง คำตอบและผล route, retrieved context, source URL
ถูกส่งให้ Promptfoo ตรวจ

```powershell
pnpm exec promptfoo validate config -c evals/p1-knowledge.eval.yaml --env-file .env.local
pnpm eval:p1
pnpm eval:view
```

หากฐานข้อมูลใช้ไม่ได้ รัน `pnpm eval:p1:seed` เพื่อประเมิน flow ด้วย
โหมด seed จะไม่อ่านฐานข้อมูล แต่ demo seed เดิมไม่มีผู้รับรองและวันตรวจสอบ
จึงเป็น knowledge miss และอาจใช้ web search จริง ห้ามนำคะแนนไปอ้างว่า
Production Knowledge ผ่านแล้ว ดู [hybrid RAG](../docs/knowledge-rag.md) สำหรับ
การนำเข้าข้อมูลที่ตรวจแล้วและการทดสอบ retrieval แบบสังเคราะห์

เกณฑ์อัตโนมัติในชุดนี้ตรวจ route ที่ระบุไว้, แหล่ง `bu.ac.th` เมื่อเคสต้องมี
หลักฐานทางการ, การไม่อ้างเลข ticket ก่อนยืนยัน และใช้ model rubric ตรวจพฤติกรรม
ของคำตอบ ไม่ได้ตรวจว่ายอดเงิน/วันกำหนด/สิทธิรายบุคคลเป็นข้อเท็จจริงล่าสุด
เคสทั้งหมดเป็น **candidate** จากหมวดที่จัดลำดับไว้ ยังไม่ใช่คำถามจริงหรือคำตอบ
ที่หน่วยงานเจ้าของข้อมูลอนุมัติ ก่อนใช้เป็น release gate ให้แทนด้วยคำถาม Contact
Center ที่ตัด PII, ใส่คำตอบ/ขอบเขต/วันมีผลและผู้รับรอง แล้วให้คนตรวจตัวอย่างผล
อีกครั้ง หาก source ไม่มีหรือข้อมูลในระบบยังไม่พร้อม ผลตกถือเป็น baseline gap
ไม่ใช่เหตุให้เปลี่ยน expected behavior ตามคำตอบของโมเดล

---

## โครงสร้างไฟล์ใน `evals/`

```
evals/
├── agent-router.eval.yaml      # คอนฟิกหลักสำหรับทดสอบ Agent Router
├── prompts/
│   └── agent-router.json       # System prompt & User prompt template
├── datasets/
│   └── agent-router.yaml       # ชุดคำถามตัวอย่างภาษาไทยของนักศึกษา ม.กรุงเทพ (25+ เคส)
└── providers/
    └── app-router.ts           # Custom Provider สำหรับรันผ่านโค้ดจริง (classifyWithAgentRouter)
```

---

## วิธีการใช้งาน (Quickstart)

### 1. ตั้งค่า Environment Variable
ตรวจสอบว่ามี `OPENAI_API_KEY` อยู่ใน `.env.local` หรือ environment ปัจจุบัน:
```bash
# Windows PowerShell
$env:OPENAI_API_KEY="sk-..."
```

### 2. รัน Evaluation
รันการทดสอบความแม่นยำของ Agent Router:
```bash
pnpm eval:router
```
Promptfoo จะยิงทดสอบตาม test cases ทั้งหมดและแสดงตารางสรุป Pass/Fail, Latency, Token usage, และ Accuracy score บน Terminal

### 3. เปิด Web Dashboard ดูผลลัพธ์
เปิดเว็บแสดงผลลัพธ์และ Matrix การเปรียบเทียบ:
```bash
pnpm eval:view
```

---

## การเปรียบเทียบหลายโมเดล (Side-by-Side Model Comparison)

ในไฟล์ `evals/agent-router.eval.yaml` สามารถเปิดใช้งานหลายโมเดลพร้อมกันได้ เช่น:
```yaml
providers:
  - id: "openai:gpt-4o-mini"
  - id: "openai:gpt-4.1-mini"
  - id: "file://evals/providers/app-router.ts"
```
เมื่อรัน `pnpm eval:router` ระบบจะเปรียบเทียบความแม่นยำ, ความเร็ว, และราคาของแต่ละโมเดลให้เห็นในตารางเดียวกันทันที

---

## การเพิ่ม Test Cases ใหม่

สามารถเพิ่มโจทย์คำถามภาษาไทยใหม่ ๆ ได้ใน `evals/datasets/agent-router.yaml`:
```yaml
- vars:
    message: "คำถามของนักศึกษา"
  assert:
    - type: json
    - type: javascript
      value: "output.selectedTarget === 'ticket' && output.intent === 'CREATE_TICKET'"
```
