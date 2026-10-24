# Admin Workspace

Open `/login` and use the server's `ADMIN_PASSWORD`. Successful login opens
`/admin`. Without a password the workspace stays closed and shows setup guidance.
Production requires HTTPS. Cookies are signed, HttpOnly, SameSite=Strict and
expire after eight hours. Restart the server after changing configuration.
Set `ADMIN_SESSION_SECRET` (32+ characters) to sign cookies with a key separate from the
password; changing `ADMIN_PASSWORD` then no longer logs admins out. Without it the password signs cookies.
Login is limited to 10 attempts per 15 minutes and 30 per hour per client IP (HTTP 429).

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
the same cookie. Mutations require a same-origin request. Password query strings,
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
