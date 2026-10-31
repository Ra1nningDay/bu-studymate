# BU StudyMate Interface Design

Source inspected: 2026-10-27, current working tree.
Status: source-inspected visual/interaction baseline with separately labeled
maintenance targets. Admin Overview, shared login/navigation and Web Chat interactions
were verified locally with synthetic persistence at desktop/mobile viewports;
see [admin-01](.scratch/admin-dashboard/issues/01-unified-workspace.md) and
[playground-01](.scratch/playground/issues/01-admin-playground.md).
LINE visual verification is outside that evidence.

## 1. Document Authority and Experience

This document owns layout, visual conventions, copy, interaction states,
responsive behavior and visual verification. [ARCHITECTURE.md](ARCHITECTURE.md)
owns technical boundaries, [CONTEXT.md](CONTEXT.md) owns vocabulary and
[.scratch/README.md](.scratch/README.md) links scope/status/verification tickets.
Read this document for UI or LINE presentation work; update affected sections
when the implemented interface changes.

StudyMate's student loop is ask → receive a grounded answer or a short
clarification → continue into campus information, saved learning context or a
ticket workflow. Admin screens support operating tickets and inspecting saved
runs. Keep student answers focused and place operational detail in admin views.

## 2. Current Screen Baseline

| Surface | Source | Existing presentation |
|---|---|---|
| `/login` | [login](src/app/login/page.tsx) | 2-column admin sign-in: StudyMate mascot poster on the left, username/password form on the right. |
| `/admin` | [overview](src/app/admin/page.tsx), [shell](src/app/admin/admin-shell.tsx) | Neutral frame and white sheet, divided KPI strip, compact daily chart, ranked intent list, knowledge counts and attention preview. |
| `/admin/chat` | [workspace](src/app/admin/chat/playground.tsx), [upload](src/app/admin/chat/study-upload.tsx) | Green reference layout: searchable history, mint user bubbles, assistant avatar, progressive SSE reply streaming, compact composer/upload and tabbed Execution Trace; responsive columns/stack. |
| `/`, `/chat` | [root](src/app/page.tsx), [chat alias](src/app/chat/page.tsx) | Redirect to `/admin` and `/admin/chat`, respectively. |
| `/admin/tickets` | [tickets page](src/app/admin/tickets/page.tsx) | Login/setup states, status badges and ticket management. |
| `/admin/runs` | [runs page](src/app/admin/runs/page.tsx), [workspace](src/app/admin/runs/runs-workspace.tsx) | Divided metric strip, 13px paginated table and selected-run panel; desktop columns, mobile stacking. |
| `/admin/agent/workflow` | [workflow](src/app/admin/agent/workflow/page.tsx), [workspace](src/app/admin/agent/workflow/workflow-workspace.tsx) | Read-only routing map, saved-run selector, ordered recorded steps and evidence inspector; framed-sheet shell and responsive stacking. |
| `/admin/knowledge` | [knowledge workspace](src/app/admin/knowledge/knowledge-workspace.tsx) | Reference table/filter layout, four corpus cards, 10/20/50-row paging and General/Content/Chunks/Usage panel; inline reviewed editor and mobile stacking. |
| `/admin/playground` | [alias](src/app/admin/playground/page.tsx), [guide](docs/playground.md) | Redirect to `/admin/chat`; old report paths redirect to new report paths. |
| LINE | [presenter](src/presenters/line-flex.presenter.ts), [templates](lib/flex-messages.ts) | Greeting, study packs, assignments, study answers and ticket confirmation. |

The standalone web tester has been consolidated into the saved-session workspace.
Reload in the same tab reads saved messages/runs for the selected session. Lesson
results display locally, while stored materials remain tied to that identity.
The browser does not render a full LINE Flex card; verify LINE delivery separately.

## 3. Existing Visual Conventions

Use [tailwind.config.ts](tailwind.config.ts) and [src/app/globals.css](src/app/globals.css)
as the source of values; this table is a navigation snapshot, not a new theme.

| Token / role | Current value |
|---|---|
| `bu-purple`, primary controls/brand | `#4b148c` |
| `bu-ink`, primary text | `#161326` |
| `bu-cyan`, secondary accent | `#16b8c8` |
| Page background | `#f7f7fb` |
| Admin frame / sheet / data accent | `--admin-ground: #f4f6f5` / white / Emerald 700 `#047857`; neutral navigation and borders. |
| Surfaces and boundaries | White panels, slate borders, small shadows, rounded corners |
| Body font stack | Inter followed by system sans-serif fallbacks; no custom font loading is established by this stack. |
| Admin font | Noto Sans Thai variable font, Thai and Latin subsets, loaded by `next/font` in the shared shell with `display: swap`; tabular figures. |

Admin chat uses mint user bubbles and pale slate assistant bubbles with preserved
line breaks; source chips sit below the reply. Controls use Lucide icons. Desktop
history, messages and trace scroll independently with the composer visible;
mobile stacks the panels. Ticket badges pair color with text:
`PENDING` amber, `IN_PROGRESS` cyan, `RESOLVED` emerald. Reuse local component
styles rather than introducing a separate design system for one screen.
The root document declares Thai; existing UI labels/copy include English.

Admin header conventions: The sidebar uses `public/logo-brand.png` as its brand
header, preserving its aspect ratio at up to 176px wide with the accessible name
`StudyMate Admin Console`. The image links to Overview and leaves room for the
sidebar collapse control.
The browser favicon uses `src/app/icon.png` (32px, with a content-versioned Next
URL) and `src/app/favicon.ico` (16/32/48px fallback): the selected white/mint S on
a rounded green square. The versioned PNG avoids reusing the old favicon URL
after a brand change. `public/favicon.png` is the original option sheet,
preserved intact; it is not served as the browser icon.
The sidebar is collapsible/toggleable across all viewports (via the header toggle button, the collapse button in the sidebar brand header, or `Ctrl+B` / `Cmd+B`), with desktop preference persisted in `localStorage`.
The top bar displays dynamic path-based breadcrumbs (`Admin / [Section]`) without redundant static brand
repetition. Each workspace screen uses the shared `AdminPageHeader` (`src/app/admin/admin-page-header.tsx`)
providing standard typography (`h1` 24px semibold), concise Thai subtitles, and right-aligned contextual
actions, eliminating redundant 'BU StudyMate' kickers and brand prefixes.

The shared shell uses the framed-sheet direction (seed 529173376), a 256px
neutral sidebar, neutral selected navigation, and a white work sheet. Existing
mock destinations remain in a collapsed `In development` group; the group opens
automatically when one of its routes is active. All destinations and existing
desktop sidebar preference storage remain intact. Hidden drawers do not receive
keyboard focus; Escape closes the mobile drawer and reduced-motion disables
shell travel. The chat workspace and print report retain their existing geometry.
Admin route changes show `src/app/admin/loading.tsx` inside the work sheet: a
neutral header/filter/metric-strip/panel skeleton (`role="status"`, Thai
screen-reader text, pulse only under `motion-safe`) while the sidebar stays usable.

Overview uses four icon-free metrics in one divided strip (two columns on phones),
a fixed-height daily chart with HTML axis labels, and an intent ranking with
counts and proportional bars. The attention and knowledge panels follow the
actual data density rather than stretching a single-intent ring across a large
panel. Zero and missing values remain distinct.

The Bot Runs workspace uses the same quiet shell and metric strip. Total Runs counts server-filtered records; success rate,
average latency and failures describe the loaded page, with explicit labels.
Search and model filtering apply to that page. Server filters retain status,
intent, channel, target and web-search support. Selected-run views expose saved
messages, router/flags, execution logs, sources and review JSON. Missing values
show a dash or a recorded-data notice; no trends, step durations or fabricated
tool-call/session details are shown. The header shows the latest loaded timestamp
in Bangkok time. Server date filters use inclusive Bangkok calendar days. No bulk actions
or additional sidebar destinations were added.

Desktop 1536×1024 and mobile 390×844 checks with synthetic persistence passed;
see [admin-02](.scratch/admin-dashboard/issues/02-runs-ui.md). Tables scroll within
their panel on narrow screens; the page does not scroll horizontally. Detail
controls are keyboard-operable and source URLs only become links for HTTP(S).

The 2026-10-31 refinement is tracked in
[admin-natural-01](.scratch/admin-natural/issues/01-visual-refinement.md). Its
production-rendering fixture imports the real shell/pages/components and replaces
authentication and data reads with synthetic fixtures. This is separate from
authenticated database UAT and deployment.

## 4. Current Interactions and States

- **Agent Workflow:** Shared Bangkok date filtering and 12-run pages reuse the
  Bot Runs reader. Selection is retained in the URL; two-way Runs links preserve
  dates, server filters, page and run. `view=trace` opens the saved Execution Trace.
  The compact map describes routing alternatives; its highlighted target is the
  saved router observation. A recorded BU Links/Web Search step after a campus
  target marks the fresh-information continuation. Actual ordered steps are
  listed separately, with only recorded states/durations. Missing telemetry is
  a dash or an explicit notice; RRF time remains part of Hybrid Retrieval.
  Node selection exposes the existing validated RAG evidence, literal chunk text
  and safe HTTP(S) sources. Shared evidence metadata is at least 12px. On narrow
  screens the run selector occupies its own row; selecting a route/step focuses
  and scrolls to its inspector, with a return link to the steps. Empty periods,
  absent selected runs, invalid dates and read failures stay explicit. The map
  does not report current service health or offer workflow editing.

- **Web Chat compose:** The Send button submits; Enter inserts a newline. Sending disables
  send/upload/session actions, shows a typing indicator before the first streamed delta,
  and progressively renders assistant tokens via SSE (`Accept: text/event-stream`) before
  finalizing the saved reply, sources and Execution Trace selection on `done`.
- **Upload:** Composer document control opens the PDF/DOCX chooser, optional course field and upload action. Show
  ingestion outcomes/OCR warnings from the server; an upload is not successful
  merely because a file was selected.
- **Failure:** Chat has a visible error region. Distinguish the failed request
  from a saved reply; inspect persisted state before retrying operational writes.
- **Sources:** Preserve source URLs/titles when returned. A displayed source
  link does not independently validate answer freshness or correctness.
  Campus RAG supplies citations from selected retrieved passage IDs; Web/LINE
  reuse the existing source presentation. Admin knowledge management is described below.
- **Ticket confirmation:** LINE presents confirm/cancel actions; retain the
  explicit draft review before creation. Status lookup is a separate workflow.
- **Playground:** Selecting a saved reply exposes its saved run in Trace, Messages,
  Sources or Raw tabs. Tabs support arrow/Home/End keys. History and trace can be
  hidden and reopened. History search covers loaded IDs, dates, states and the
  selected transcript's first question; unselected sessions retain ID/date labels
  because the list API does not supply titles or message previews. Reports read
  stored transcripts. Auth/error/empty states follow the Playground guide.
  Desktop uses session/chat/trace columns; mobile stacks them without horizontal
  scrolling. Its textarea accepts newlines and the Send button submits. Sending
  disables session changes; failures retain the input and reload saved state
  without repeating the POST. Reload restores the selected session in the same
  tab. Failed runs without a reply remain selectable. A missing admin password
  shows a setup state. The operational write notice was removed from the chat
  header at the user's request; environment guidance remains in the chat guide.
  Knowledge/RAG steps retain this layout and expand into query changes, actual
  keyword/vector counts, RRF/cosine values, candidate text and selected ranks.
  Status and measured duration appear beside the step summary. RRF labels its
  shared SQL timing; reranker labels rank changes without inventing a score.
  Sources remain the final answer's citations. Old runs show only recorded data;
  report chunk text opens by default. Long URLs truncate visually with the full
  address on hover; long passage text wraps and renders literally.
- **Admin access:** One login covers Overview, Web Chat, reports, Tickets, Runs and
  their private APIs. No password is passed through links or ticket forms. The
  shared header provides logout; mobile navigation opens as a dismissible drawer.
- **Analytics dates:** Overview, Runs and Cost use the same `DateRangeFilter`
  (`src/app/admin/date-range-filter.tsx`) below the page header and before KPI cards.
  Labels, 192px desktop inputs, 44px controls and 12px gaps are shared. Inputs,
  Apply and quick presets align at the bottom on wide screens and wrap in the
  same order on narrow screens. The Bangkok/inclusive-end/366-day helper occupies
  its own row below the controls. Presets are 7/30/90/365 days including Bangkok
  today, with an explicit selected state. Today is supplied by the server so
  client hydration does not recompute it in a different time zone.
  Start/end persist as `from`/`to` URL parameters, including reload and browser Back.
  Default: seven Bangkok calendar days; end is inclusive, with a 366-day limit.
  Invalid dates show an alert before data reads. Bot Runs separates the date form
  from search/status/intent/channel/model and other filters. Applying dates or a
  preset preserves applied server filters and resets pagination/selection; applying
  or resetting other filters retains the selected dates. Page/detail and
  Overview-to-Runs links preserve dates. Current ticket/knowledge snapshots remain
  independent of the range. See
  [analytics-dates-02](.scratch/analytics-dates/issues/02-consistent-date-filter.md).
- **Cost:** Read recorded token logs plus remaining legacy BotRun totals, never
  sample values. Unknown prices/cache data show a dash; a query error shows an
  alert, and an empty period shows zero tokens with an empty-state message.
  Stored prices are estimates, converted at the displayed fixed THB/USD rate.
  Legacy totals and unsupported/missing model breakdowns stay visibly unpriced.
  Prompt cached-token ratio is distinct from semantic-cache hits. Daily bars scroll
  within their panel and expose the numeric values in keyboard-operable details.
  See [analytics-dates-01](.scratch/analytics-dates/issues/01-real-usage-date-filters.md)
  for real read-only DB checks and synthetic browser evidence at 1440/768/390px.
- **Overview:** Actual recorded metrics include LINE and web tests in the selected period.
  Use Successful Runs instead of unmeasured Resolution Rate. Knowledge Snapshot
  shows counts without an invented healthy/processing status or trend change.

## 5. Copy and Interaction Targets

The Knowledge Base destination follows the supplied table/detail reference with
the shared emerald shell and white panels. Four cards show actual corpus counts
for total, ready, unapproved and needing review/index attention. Search and
category/status/source filters cover all storage before 10/20/50-row pagination.
Rows show title/content excerpt, category, source host, passages, updated date and
status; category colors stay consistent across rows. A selected row opens the
right panel with General, Content, Chunks and Usage tabs, keyboard arrow/Home/End
support and a close control. Details preserve literal text and safe source links.
Chunks show actual indexed passages and model labels. The article preview uses
stored text; file size, PDF page count, processing/trend metrics and per-document
usage are unavailable. Retrieval Playground opens Web Chat/Execution Trace.

Verified locally at 1536×1024, 1024×768 and 390×844 with synthetic knowledge API
mutations and actual Next rendering; see [knowledge-admin-01](.scratch/knowledge-admin/issues/01-knowledge-tab.md).

Add/edit uses an inline labeled form, with fixed titles for existing documents,
reviewed content, comma-separated keywords, official source URL/snapshot hash,
reviewer and explicit Bangkok dates. Source snapshots do not imply approval;
an unchecked review confirmation prevents saving and resets after content edits.
Pending operations disable competing actions; failed saves retain form values.
Leaving a changed form inside this workspace requires discarding its edits.
Single source checks refresh status without renewing approval. There is no
bulk import or document extraction control. Columns stack below the wide desktop
breakpoint, tables scroll within their panel and long content/URLs wrap.

Row checkboxes support independent multi-select; title selection controls detail
preview. The header checkbox selects the visible page with an indeterminate state
for partial selection. A count/action bar offers bulk category/keyword edits,
confirmed deletion and clear selection. Bulk fields require explicit enablement;
keywords replace existing lists, and an enabled empty field clears keywords.
Deletion identifies count/titles and removes passages with their articles.
Filters/page changes clear selection; failed writes retain inputs/selection.
Pending writes disable competing controls. Category changes may call embeddings;
the edit form explains this and preserves text/source/approval dates. All bulk
writes use selected record versions and atomic transactions. See
[knowledge-admin-02](.scratch/knowledge-admin/issues/02-bulk-actions.md) for evidence.

These are maintenance targets, not a claim that every existing screen satisfies
them. Implement only through a task with acceptance criteria.

- Follow the glossary's Operator-style Reply and Progressive Detail: short,
  direct replies in the student's latest language; expand when requested.
  Static Guides and safety-critical information have different length needs.
- Keep uncertainty visible for unverified BU information. Do not invent official
  facts, ticket completion, freshness or Human Handoff.
- Explain the next action in errors and confirmations. Distinguish ticket draft,
  confirmed creation and actual status updates using the server result.
- Keep admin traces and provider diagnostics readable without exposing them as
  the normal student conversation.
- Preserve useful existing Thai/English wording unless copy changes are in scope.

## 6. Responsive and Accessibility Targets

For affected screens verify narrow mobile and desktop layouts, long Thai/English
text, source URL wrapping and upload/confirmation controls. Keep composer/actions
reachable with the mobile keyboard open and avoid page-wide horizontal scrolling.

Use semantic controls, visible labels/focus, readable contrast and status text
alongside color. Validate keyboard navigation, loading/error announcements and
touch targets. Verify IME composition before treating Enter as send: the current
web handler checks Enter/Shift only, so IME safety remains an unverified target.
Do not label accessibility or responsive behavior as passed from source alone.

## 7. Verification and Maintenance

For a UI change, record route, viewport, tested states and screenshots/results in
its ticket. Check idle/loading/success/error/empty states, keyboard/IME behavior
and real text wrapping. Inspect LINE messages on LINE separately from web JSON
inspection. Use test data for operational flows and the intended provider/database
environment for real behavior checks.

Run `pnpm typecheck` and `pnpm lint` for code changes; those checks do not replace
visual or workflow verification. This setup changed documentation only and did
not run UI/provider/database checks. Update the source snapshot date only when
the affected source has been inspected again.

The Web Chat reference update was verified locally on 2026-10-12 at 1536×1024,
1024×768 and 390×844 with synthetic persistence and stubbed uploads. This includes
long Thai text/source wrapping, empty/loading/error states, trace keyboard tabs,
session/send/reload, reports and mobile navigation; see
[admin-03](.scratch/admin-dashboard/issues/03-chat-ui.md). Real DB/provider, mobile
keyboard/IME and LINE checks remain separate.
