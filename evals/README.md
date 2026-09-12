# BU StudyMate: LLM Evaluation with Promptfoo

โฟลเดอร์นี้รวบรวมการตั้งค่าและชุดคำถามสำหรับทำ **Automated LLM Evaluation, Benchmark และ Regression Testing** ด้วย [Promptfoo](https://promptfoo.dev/)

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
