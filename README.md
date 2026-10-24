# BU StudyMate

> **Project Phase:** `UAT (User Acceptance Testing)`  
> Intelligent LINE OA & Web Assistant for Bangkok University Students.

---

## What It Does

**BU StudyMate** is an AI-powered student assistant designed to streamline campus life and academic learning for Bangkok University (BU) students:

1. 🎓 **Verified Campus Knowledge (12 Core Categories):** Answers questions about registration, dropping courses, tuition payments, scholarships (กยศ./กรอ.), Surat Osathanugrah library, inter-campus shuttle vans, infirmary & insurance, dress codes, and campus facilities.
2. 🔧 **Classroom & Facility Ticketing:** Detects reported issues (e.g. broken AC, faulty projectors, lost items), gathers details, creates formal tickets (`BU-TICKET-xxxx`), and tracks resolution status.
3. 📝 **Study Memory & AI Tutor:** Ingests lecture notes, PDFs, and DOCX files (with Thai OCR fallback), extracts key concepts and homework deadlines, and provides tutor interactions (Friend Explain, Flashcards, Practice Questions, Exam Summaries).
4. 🌐 **Fresh Info & Web Search:** Intelligently routes time-sensitive queries (holidays, academic calendar, admission deadlines) to verified web search.
5. 📊 **Admin Portal:** Sign in once at `/login` for `/admin` Overview, Bot Runs and ticket management. Overview uses actual recorded metrics. See [Admin workspace guide](docs/admin-workspace.md).
6. 🧪 **Admin Web Chat:** Test without LINE at `/admin/chat`, inspect saved traces, resume sessions, upload lessons and open printable reports. Requires an admin account (`pnpm admin:create`); uses the configured database and AI providers with real writes. `/chat` and `/admin/playground` redirect here. See [chat/trace guide](docs/playground.md).
7. 🧪 **Automated LLM Evaluation:** Integrated Promptfoo benchmark suite to continuously evaluate router accuracy, prevent hallucination, and guard prompt quality.

---

## Layered Architecture

```
bu-studymate/
├── app/
│   ├── api/                   # Thin Route Handlers (HTTP entry points only)
│   │   ├── chat/              # Web chat and file upload endpoints
│   │   ├── line/              # LINE webhook & imagemap endpoints
│   │   └── admin/             # Admin ticket status management
│   ├── admin/                 # Admin dashboard pages (React Server Components)
│   └── chat/                  # Web chat client interface
├── src/
│   ├── config/                # Centralized environment validation (Zod env.ts)
│   ├── controllers/           # HTTP controllers (request parsing, DTO validation)
│   ├── dtos/                  # Data Transfer Objects & Zod validation schemas
│   ├── services/              # Pure Business Logic, state machines & AI orchestration
│   ├── presenters/            # UI formatting, LINE Flex templates & Web response shaping
│   ├── repositories/          # Data Access Layer (Prisma queries)
│   └── data/                  # Static seed data (bu-knowledge.ts)
├── evals/                     # Promptfoo LLM Evaluation & Regression Test Suite
├── lib/                       # External SDK clients (line.ts, prisma.ts, ai.ts) & facades
├── prisma/                    # Database schema and migrations
└── scripts/                   # Operational scripts (seed-knowledge, rich-menu upload)
```

---

## Prerequisites & Installation

- **Node.js**: 20+
- **Package Manager**: `pnpm` (11+)
- **Database**: PostgreSQL (Supabase)

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Environment Configuration

Copy `.env.example` to `.env.local` and set required credentials:

```bash
cp .env.example .env.local
```

Essential variables:

```bash
# Database
DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.<ref>:<password>@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres"

# LINE Messaging API
LINE_CHANNEL_ACCESS_TOKEN=your-channel-access-token
LINE_CHANNEL_SECRET=your-channel-secret

# AI & LLM
OPENAI_API_KEY=your-openai-key
OPENAI_AGENT_ROUTER_MODEL=gpt-4.1-mini
OPENAI_WEB_SEARCH_MODEL=gpt-4.1-mini
OPENROUTER_API_KEY=your-openrouter-key
AGENT_ROUTER_MODE=openai
JEV_ROUTER_MODEL=typesafe/jev-1.13
JEV_ROUTER_MIN_PROBABILITY=0.8

# App & Admin
ADMIN_SESSION_SECRET=generate-with-openssl-rand-hex-32
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Study Memory & OCR
STUDY_MEMORY_OCR_ENABLED=true
STUDY_MEMORY_OCR_LANG=tha+eng
```

`AGENT_ROUTER_MODE=openai` keeps the existing router. Use `shadow` to compare Jev
with the OpenAI router while OpenAI still chooses the route. Use `jev` only after
reviewing the routing benchmark; low-probability or failed Jev decisions fall
back to the OpenAI router. `JEV_ROUTER_MIN_PROBABILITY` is a provisional cutoff
and should be tuned against labeled student questions before enabling `jev` for
users. The OpenRouter key stays server-side. Shadow logs contain decision labels,
probability, cost, and timing, without the student message. Keep `OPENAI_API_KEY`
configured for fallback and answer generation.

To run the application router benchmark with Jev, set `AGENT_ROUTER_MODE=jev`
for the command and run:

```powershell
$env:AGENT_ROUTER_MODE="jev"
pnpm exec promptfoo eval -c evals/agent-router-app.eval.yaml --env-file .env.local
Remove-Item Env:AGENT_ROUTER_MODE
```

### 3. Database Setup & Seeding

```bash
pnpm db:generate              # Generate Prisma Client
pnpm db:migrate:dev           # Run migrations (local)
pnpm seed:knowledge           # Seed 12 verified BU Knowledge records
```

### 4. LINE Rich Menu Setup (Optional / Production)

```bash
pnpm line:richmenu:upload     # Upload and set the official rich menu
```

### 5. Start Development Server

```bash
pnpm dev
```

---

## UAT Test Scenarios & Verification Checklist

During the UAT phase, testers can verify system behavior across the following 5 key workflows:

### Scenario 1: Campus Knowledge Q&A
- **Test Query 1:** `BU Wi-Fi ต่อยังไง`
  - *Expected:* Instructions for BU-Airnet and BU Mobile with MAC address registration link (`inet.bu.ac.th`).
- **Test Query 2:** `ติดต่อขอดรอปเรียนหรือขอใบรับรองได้ที่ไหน`
  - *Expected:* Registrar office location (A3, 1st floor), contact numbers, and URMS link.
- **Test Query 3:** `รถตู้ไปกล้วยน้ำไทขึ้นตรงไหน`
  - *Expected:* Pickup points (A3 / front gate), operating hours, and fare details.
- **Test Query 4:** `ห้องสมุดเปิดกี่โมง`
  - *Expected:* Operating hours for Surat Osathanugrah Library and study room booking info.

### Scenario 2: Classroom Ticketing & Facilities
- **Test Query 1:** `แอร์ห้อง LAB 2 อาคาร A3 ไม่เย็นเลยครับ`
  - *Expected:* Bot recognizes facility problem, summarizes room details, and asks for confirmation.
- **Test Query 2:** Confirm the draft
  - *Expected:* Generates ticket code (e.g. `BU-TICKET-0001`) and confirms forwarding to facilities team.
- **Test Query 3:** `เช็คสถานะ ticket BU-TICKET-0001`
  - *Expected:* Returns current status (PENDING / IN_PROGRESS / RESOLVED).

### Scenario 3: Study Memory & AI Tutoring
- **Text Note:** Send `/addnote MKT101 Homework 2 due next Friday. Details: 4P marketing analysis`
  - *Expected:* Confirms note saved, extracts assignment deadline.
- **File Upload:** Upload a lecture PDF or DOCX file via LINE or the authenticated `/admin/chat` workspace.
  - *Expected:* System ingests content (runs OCR if scanned), summarizes key points, and provides interactive tutoring options.
- **Follow-up:** `สรุปประเด็นสำคัญของวิชานี้ให้หน่อย` or tap **Flashcards**.
  - *Expected:* AI Tutor generates interactive study cards and concise review questions.

### Scenario 4: Fresh Info & Web Search
- **Test Query 1:** `วันนี้มหาวิทยาลัยเปิดไหม มีวันหยุดอะไรบ้างเดือนนี้`
  - *Expected:* AI conducts verified web search and returns current academic schedule.
- **Test Query 2:** `กำหนดการรับสมัครนักศึกษาใหม่รอบล่าสุดสิ้นสุดวันไหน`
  - *Expected:* Real-time admission deadline from verified BU sources.

### Scenario 5: Admin Portal & Management
- Navigate to: `http://localhost:3000/admin/tickets` (or deployed domain)
- Sign in with an account created by `pnpm admin:create <email> admin`
- Verify list of open tickets, review descriptions, and toggle statuses (`IN_PROGRESS`, `RESOLVED`).

---

## LLM Evaluation & Regression Testing (Promptfoo)

We use [Promptfoo](https://promptfoo.dev/) for continuous evaluation of semantic intent classification:

```bash
pnpm eval:router              # Run 27 benchmark cases against Agent Router
pnpm eval:view                # Launch interactive Web Dashboard
```

### GitHub Actions CI

Promptfoo evaluation is also automated via GitHub Actions (`.github/workflows/promptfoo.yml`):
- **Triggers:** Automatically on Pull Requests modifying `evals/**` or router logic, or manually via `workflow_dispatch`.
- **Requirement:** Ensure `OPENAI_API_KEY` is added to repository Secrets (**Settings > Secrets and variables > Actions**).

---

## Quality Gate

Before submitting pull requests or concluding changes, ensure all quality gates pass:

```bash
pnpm typecheck                # TypeScript strict check (0 errors)
pnpm lint                     # ESLint check (0 errors, 0 warnings)
```

---

## License & Team

Developed for Bangkok University (BU) student body. All rights reserved.
