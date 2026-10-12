# Admin Workspace

Open `/login` and use the server's `ADMIN_PASSWORD`. Successful login opens
`/admin`. Without a password the workspace stays closed and shows setup guidance.
Production requires HTTPS. Cookies are signed, HttpOnly, SameSite=Strict and
expire after eight hours. Restart the server after changing configuration.

| Route | Purpose |
|---|---|
| `/admin` | Overview from actual database aggregates. |
| `/admin/chat` | Non-LINE chat, saved sessions, traces, reports and lesson upload. |
| `/admin/runs` | Bot run review and filtering. |
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
No Resolution Rate, source-processing status, prior-period percentage changes,
global search, knowledge editor or settings screen is added by this task.

## Web testing

See the [chat/trace guide](playground.md). The same configured database and AI
providers are used. Operational writes are real; use the intended test database.
Reports read storage without invoking AI. Lesson upload creates the selected
session before storing the material, so an upload-first session can resume.
Upload results display locally; chat reports cover saved text turns.

## Checks

```powershell
pnpm exec tsx --test src/services/admin-workspace.test.ts src/services/playground.test.ts lib/concise-chat.test.ts
pnpm typecheck
pnpm lint
```

Tests use synthetic storage/provider boundaries. Real PostgreSQL/provider UAT,
LINE delivery and deployment are separate verification claims.
