# Admin Workspace

Open `/login` and sign in with your email and password; success opens `/admin`.
Admin accounts live in the `users` table and are governed by roles:

- `admin`: full access, including every write (chat send, lesson upload, knowledge save/bulk/check,
  ticket status, deleting a student link).
- `viewer`: read-only. Every admin page and read API works; each write returns 403.

A user without `admin` or `viewer` (for example a student) cannot sign in. The session cookie holds
only the user id and an expiry; every request re-reads the user and roles from the database, so
disabling a user (`disabled_at`) or changing roles takes effect immediately. There is no screen for
managing users or changing passwords yet.

```powershell
pnpm admin:create you@example.com admin     # new user: prints a random password once
pnpm admin:create reader@example.com viewer
pnpm admin:create you@example.com viewer    # existing user: adds the role, password untouched
pnpm admin:reset you@example.com            # prints a new random password once
```

Set `ADMIN_SESSION_SECRET` (32+ characters) to enable the workspace; without it `/login` shows setup
guidance. Production requires HTTPS. Cookies are signed, HttpOnly, SameSite=Strict and expire after
eight hours. Restart the server after changing configuration.
Login is limited to 10 attempts per 15 minutes and 30 per hour per client IP (HTTP 429). The client IP is read from `x-forwarded-for`, which is only trustworthy behind Vercel (or another proxy that overwrites it); to log every admin out, rotate `ADMIN_SESSION_SECRET`.

### Rollout runbook

1. Set `ADMIN_SESSION_SECRET` in Vercel.
2. Apply the migration to production: `pnpm db:migrate:deploy` against the production URL.
3. Create your account against the same database: `pnpm admin:create <your email> admin`; store the printed password.
4. Deploy (this logs every admin out once; Vercel's production build also runs the migration).
5. Confirm login works, then delete `ADMIN_PASSWORD` and `ADMIN_USERNAME` from Vercel.
6. A student who bound between steps 2 and 4 landed only in `student_accounts`; re-run the backfill:
   `INSERT INTO users (email, line_user_id, verified_at) SELECT lower(email), line_user_id, verified_at FROM student_accounts ON CONFLICT DO NOTHING;`
   then `INSERT INTO user_roles (user_id, role_id) SELECT u.id, r.id FROM users u JOIN student_accounts s ON u.line_user_id = s.line_user_id CROSS JOIN roles r WHERE r.name = 'student' ON CONFLICT DO NOTHING;`

| Route | Purpose |
|---|---|
| `/admin` | Overview from actual database aggregates. |
| `/admin/chat` | Non-LINE chat, saved sessions, traces, reports and lesson upload. |
| `/admin/runs` | Bot run review and filtering. |
| `/admin/knowledge` | Campus article search, reviewed add/edit and source checks. |
| `/admin/tickets` | Ticket review and status updates. |
| `/admin/chat/report/{sessionId}` | Printable saved conversation report. |

Root redirects to `/admin`; `/chat` and `/admin/playground` redirect to
`/admin/chat`. Old Playground report URLs redirect to the new report path.
The old login/logout API paths use the shared auth controller for compatibility.
An existing Playground cookie requires signing in again with the new admin cookie.

Every admin data page checks auth before reading storage, alongside its layout
guard. Playground, `/api/chat`, `/api/chat/upload` and ticket mutation APIs check
the same cookie. Mutations require the `admin` role and a same-origin request. Password query strings,
hidden form passwords and `x-admin-password` no longer authorize access. Legacy
password queries on Tickets/Runs redirect to clean URLs after authentication.
LINE webhooks keep their separate signature-based authentication.

## Overview definitions

The seven-day window starts at midnight in Bangkok six days before today and
ends at the server read time. It includes LINE and web test traffic.

- **Total Conversations:** distinct `lineUserId` values with a user message in
  the window. This is an identity count, not individual conversation sessions.
- **Conversation Trends:** daily distinct identities by Bangkok calendar date.
  A returning identity can count on multiple days; daily counts do not add up
  to the period's distinct identity count.
- **Successful Runs:** `success` runs divided by all runs in the window,
  including `processing` and `error`. This is not a problem-resolution rate.
- **Avg Response Time:** mean recorded `latencyMs` from successful runs. Runs
  without latency are excluded; no recorded latency displays an unknown value.
- **Top Intents:** counts from all runs in the window, with top five categories
  and the combined remainder. Null intent stays explicitly unclassified.
- **Open Tickets:** current `PENDING` + `IN_PROGRESS` count, regardless of age.
- **Knowledge Snapshot:** current KnowledgeItem, StudyMaterial and MaterialChunk
  counts. These do not establish source indexing health or answer correctness.
- **Needs Attention:** up to five most recently updated open tickets and five
  most recent error runs from the window. It is a bounded preview, not all issues.

Database failures show a read error rather than invented zero/healthy metrics.
No Resolution Rate, prior-period percentage changes, global search or settings
screen is included. Knowledge management is described below.

## Campus knowledge management

Open **Knowledge Base** in the sidebar. Search covers stored article titles,
categories/content and exact keywords, with 10/20/50 articles per page. Category,
status and source filters apply across storage before pagination. Summary cards
count all stored documents independently of search/filters: ready, unapproved and
requiring review/index attention. No processing or trend metrics are inferred.
Select a document to
inspect its text, passage count, source, reviewer and review/validity dates.
Unapproved or stale legacy content remains visible but is excluded from RAG.

The supplied reference UI uses a selectable table beside General, Content,
Chunks and Usage tabs. Chunks read actual indexed passages with model labels,
without exposing vectors. The preview shows stored article text; original PDF
files, byte size, page count and upload provenance are not stored in this pipeline.
Usage has no invented per-document totals. **Retrieval Playground** opens the
existing Web Chat/Execution Trace, and the usage panel links Knowledge Base runs.
The detail panel can close; tables scroll inside their panel on mobile.

Use **เพิ่มบทความ** or **แก้ไข / ตรวจทาน**, open the official BU source and
retrieve its snapshot. Supply reviewed text, reviewer and dates in Bangkok time;
confirm the review before **บันทึกและสร้างดัชนี**. Existing titles stay fixed.
Duplicates cannot silently overwrite another article. Shared ingestion verifies
the source and prepares embeddings before atomically replacing the document and
passages; failures retain previous evidence and the form. Unchanged content may
reuse embeddings. The named reviewer remains an admin assertion, not a separate
reviewer identity check. See [the RAG guide](knowledge-rag.md) for source limits.

**ตรวจแหล่งข้อมูล** checks only the selected reviewed article and refreshes
its availability. It never advances review dates. Changed/unavailable sources need
inspection and, when appropriate, a new review. No bulk import or file extraction
is provided. Saves can use the configured embedding provider.

Use the row checkboxes for multi-select; clicking an article title still opens
its independent detail preview. The header checkbox selects only the visible
page (up to 50 articles); search/filter/page changes clear selection. Bulk actions
appear with the selected count. **แก้ไขที่เลือก** optionally changes a common
category and/or replaces keywords. Enable the keyword field and leave it empty
to clear keywords. Disabled fields stay unchanged. Text, sources, reviewer and
approval/validity dates remain unchanged.

Category changes prepare embeddings for compatible existing passages before
an atomic transaction; keyword-only edits reuse embeddings and refresh lexical
tokens/fingerprints. Missing or stale indexing remains excluded and requires
individual review. A stale selection, provider failure or transaction failure
leaves the entire batch unchanged. **ลบที่เลือก** shows count/titles before deleting
the selected articles and their passages together. This screen cannot restore
deleted articles. Failed actions retain selection and the edit form; successful
actions refresh rows and counts without automatic mutation retries.

## Web testing

See the [chat/trace guide](playground.md). The same configured database and AI
providers are used. Operational writes are real; use the intended test database.
Reports read storage without invoking AI. Lesson upload creates the selected
session before storing the material, so an upload-first session can resume.
Upload results display locally; chat reports cover saved text turns.

## Checks

```powershell
pnpm exec tsx --test src/services/admin-workspace.test.ts src/services/playground.test.ts lib/concise-chat.test.ts
pnpm exec tsx --test src/services/knowledge-admin.test.ts lib/knowledge-rag.test.ts
pnpm typecheck
pnpm lint
```

Tests use synthetic storage/provider boundaries. Real PostgreSQL/provider UAT,
LINE delivery and deployment are separate verification claims.
