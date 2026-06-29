# BU StudyMate

Stable 1-day MVP for a LINE OA chatbot for Bangkok University students.

## What It Does

- Answers basic BU questions from a curated Supabase knowledge base.
- Creates classroom/facility support tickets from LINE messages.
- Checks ticket status by ticket code.
- Provides a simple `/admin/tickets` dashboard for staff.
- Uses Prisma ORM against Supabase Postgres.
- Keeps OpenAI optional. Without `OPENAI_API_KEY`, the bot replies with the stored verified knowledge.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a Supabase project.

3. Copy `.env.example` to `.env.local` and set:

   ```bash
   LINE_CHANNEL_ACCESS_TOKEN=
   LINE_CHANNEL_SECRET=
   DATABASE_URL=
   DIRECT_URL=
   OPENAI_API_KEY=
   OPENAI_WEB_SEARCH_MODEL=
   ADMIN_PASSWORD=
   STUDY_MEMORY_MAX_FILE_BYTES=10485760
   STUDY_MEMORY_OCR_ENABLED=true
   STUDY_MEMORY_OCR_LANG=tha+eng
   STUDY_MEMORY_OCR_MAX_PAGES=5
   ```

   Supabase pooler example:

   ```bash
   DATABASE_URL="postgresql://postgres.<project-ref>:<db-password>@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true"
   DIRECT_URL="postgresql://postgres.<project-ref>:<db-password>@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres"
   ```

4. Generate Prisma Client:

   ```bash
   npm run db:generate
   ```

5. Apply migrations in local development:

   ```bash
   npm run db:migrate:dev
   ```

   For production or Vercel deploys, use:

   ```bash
   npm run db:migrate:deploy
   ```

6. Seed the demo knowledge base:

   ```bash
   npm run seed:knowledge
   ```

7. Start the app locally:

   ```bash
   npm run dev
   ```

8. Expose localhost for LINE testing, for example:

   ```bash
   ngrok http 3000
   ```

9. Set the LINE webhook URL:

   ```text
   https://<ngrok-domain>/api/line/webhook
   ```

10. Deploy the Next.js app to Vercel.

11. Add the same environment variables in Vercel.

12. Set the production LINE webhook URL:

   ```text
   https://<vercel-domain>/api/line/webhook
   ```

13. Test the chatbot in LINE.

## Demo Checklist

- Ask: `BU Wi-Fi ใช้ยังไง`
- Ask: `วันหยุดมหาวิทยาลัยดูได้ที่ไหน`
- Report: `อาคาร A3 ชั้น 2 ห้อง LAB 2 แอร์ไม่เย็น`
- Open `/admin/tickets`
- Update the ticket status.
- Ask: `เช็ค ticket BU-TICKET-0001`

## Study Memory Demo Script

1. Save a class note:

   ```text
   /addnote Data Structure
   Homework 3 due May 27, 2024 23:59
   Details:

   * Implement Linked List
   * Write in C++
   * Upload .cpp and .pdf via BU Online
   Professor explained Queue follows FIFO and is useful for task scheduling and BFS.
   ```

   Expected: StudyMate confirms the note was saved and mentions `Homework 3` with `May 27, 2024 23:59`.

2. Ask the assignment due date:

   ```text
   งาน Data Structure ส่งวันไหน
   ```

   Expected: StudyMate answers from the saved assignment.

3. Ask a lecture detail:

   ```text
   อาจารย์พูดเรื่อง Queue ว่ายังไง
   ```

   Expected: StudyMate answers from the saved note: FIFO, task scheduling, and BFS.

4. Summarize the latest class:

   ```text
   สรุปคลาส Data Structure ล่าสุดให้หน่อย
   ```

   Expected: StudyMate summarizes the latest saved Data Structure note.

5. Ask for missing information:

   ```text
   อาจารย์พูดเรื่อง Stack ว่ายังไง
   ```

   Expected: StudyMate replies `ยังไม่พบข้อมูลนี้ในโน้ตที่บันทึกไว้ครับ`.

## Study File Uploads

- LINE users can send PDF or DOCX files directly to the bot. The bot downloads the file, extracts readable text, saves it as Study Memory, and reuses the same assignment extraction and Q&A flow as `/addnote`.
- In the web tester, use `/chat` and upload a PDF or DOCX with an optional course name.
- PDF text extraction runs first. If the PDF contains very little embedded text, StudyMate renders up to `STUDY_MEMORY_OCR_MAX_PAGES` pages and runs OCR with `STUDY_MEMORY_OCR_LANG`.
- Scanned PDFs can be slow on first OCR use because Tesseract language data may need to load. Set `STUDY_MEMORY_OCR_ENABLED=false` to disable OCR fallback.

## Routes

- `POST /api/line/webhook`
- `GET /admin/tickets`
- `POST /api/admin/tickets/[id]/status`

## Notes

- Prisma uses `DATABASE_URL` for runtime queries and `DIRECT_URL` for direct schema operations.
- Use `db:migrate:dev` only in development. Use `db:migrate:deploy` for production.
- The curated search currently matches title, category, keywords, and content.
- Some freshness-sensitive BU questions can use OpenAI web search. Set `OPENAI_WEB_SEARCH_MODEL` to a model that supports the Responses API web search tool, for example `gpt-4.1-mini`.
- Study Memory stores text notes plus extracted PDF/DOCX content. OCR fallback is available for scanned PDFs. Audio, embeddings, and vector search are intentionally deferred.
- The schema includes `embedding vector(1536)` so pgvector RAG can be added later.
- The bot is designed to avoid inventing BU policies, tuition, deadlines, or official procedures.
