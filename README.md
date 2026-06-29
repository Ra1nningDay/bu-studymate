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
   ADMIN_PASSWORD=
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

## Routes

- `POST /api/line/webhook`
- `GET /admin/tickets`
- `POST /api/admin/tickets/[id]/status`

## Notes

- Prisma uses `DATABASE_URL` for runtime queries and `DIRECT_URL` for direct schema operations.
- Use `db:migrate:dev` only in development. Use `db:migrate:deploy` for production.
- The curated search currently matches title, category, keywords, and content.
- The schema includes `embedding vector(1536)` so pgvector RAG can be added later.
- The bot is designed to avoid inventing BU policies, tuition, deadlines, or official procedures.
