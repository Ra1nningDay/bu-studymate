# Admin Web Chat and Playground

Sign in at `/login` with the server's `ADMIN_PASSWORD`, then open `/admin/chat`.
`/admin/playground` redirects to this shared Web Chat screen. See the
[admin workspace guide](admin-workspace.md) for routing and metric definitions.
The page and its APIs require authentication, including conversation reports.
The password is submitted by POST; a signed, HttpOnly, SameSite=Strict cookie
expires after eight hours. Production cookies require HTTPS. Without an admin
password the Playground stays closed. Restart the server after changing config.

## Testing a conversation

1. Start a new conversation and send a message.
2. Select an assistant reply to inspect its saved run. Failed runs without a
   reply have their own trace button.
3. Select a saved session to continue it. The sidebar shows the newest 50
   sessions; the selected session is restored after reload in the same tab.
4. Open the report for the complete saved transcript and every run. Browser
   Print can save the report as PDF. Opening or refreshing a report never calls
   AI or replays a message.

The Playground uses the same `ChatOrchestrationService`, web channel and rate
limits as the web chat API. `/chat` now redirects to `/admin/chat`.
Each session gets a `web-chat-playground-<UUID>` identity;
it never impersonates a LINE user or sends LINE replies. No schema migration
or additional environment variable is needed.

The document button beside Send opens lesson upload. Files and course context use the
selected session's identity; an upload-first session is created before saving.
The result summary displays locally, while the saved material is available to
later chat turns. Upload summaries are not separate turns in conversation reports.

History and Execution Trace can be hidden and reopened. Search covers the loaded
session IDs, dates, states and the selected conversation's first question. Other
sessions display their ID/date because the session list API has no message preview
or title. Refresh is in the three-dot conversation menu. Enter inserts a newline;
the Send button submits. Reports remain available beside the document control.

**Use a test database.** The configured `DATABASE_URL` and configured AI
providers are used directly. Ticket creation, study notes and rate-limit events
are real writes, and configured provider calls may cost money. A new session
isolates conversation identity; it does not create a separate database or make
operational writes a dry run. Existing LINE data is not imported into this view.

## Trace coverage

Traces show linked run/message IDs, intent, router type/reason/confidence,
selected target, recorded model/token totals, total latency, execution log,
source URLs, workflow flags and saved errors. Missing fields say they were not
recorded; flags describe the existing stored flags, not independent proof of
each external call. The session state is captured before executing the reply.

Execution Trace has Trace, Messages, Sources and Raw tabs. Arrow/Home/End keys
select tabs. Recorded log entries expand to show details. The Bot Runs link passes
the run ID to its existing page selection; selection there is limited to the loaded
run page. Reports keep every trace section visible without tab selection.

This version reads traces after a turn completes. It does not add live SSE,
per-step timing, per-call token accounting, prompt editing or model switching.
Reports read current database records rather than a cached export. A provider
failure can leave an error run; failures before run creation may have no trace.
After a send failure, inspect the transcript before manually retrying: the UI
never automatically repeats a message POST.

## Verification

```powershell
pnpm exec tsx --test src/services/playground.test.ts
pnpm test:concise-chat
pnpm typecheck
pnpm lint
```

The focused tests use synthetic data and intercepted AI calls; they do not
write to a database or contact a paid provider. Validate real database/provider
behavior separately in the intended test environment and validate LINE delivery
on LINE.
