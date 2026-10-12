# admin-03: Web Chat Reference Layout

Type: feature
Status: resolved
Updated: 2026-10-12
Blocked by: none

## Scope

Restyle `/admin/chat` to the supplied green reference: conversation history,
chat bubbles/composer and Execution Trace with tabs. Reuse saved sessions,
uploads and recorded run data. Preserve auth, errors and reports. The user later
requested removal of the operational write notice from the chat header.
No invented sources/scores/step timings or unsupported navigation.

## Acceptance Criteria

- [x] Reference layout, searchable history, selectable replies and trace tabs.
- [x] New session, refresh, sending, uploads and reports remain usable.
- [x] Desktop/mobile, empty/error/loading, keyboard and safe text/source checks.
- [x] Focused regressions, typecheck, lint, docs and graph refresh recorded.

## Verification

- `pnpm exec tsx --test src/services/playground.test.ts src/services/admin-workspace.test.ts`: 24 passed.
- `pnpm typecheck`: passed.
- `pnpm lint --ignore-pattern ".promptfoo/**" --ignore-pattern "output/**" --ignore-pattern ".playwright-cli/**"`: passed. Plain `pnpm lint` also scanned old generated fixture builds and failed on those files; application source had no lint errors. No lint rules were relaxed.
- Real Next routes/rendering with isolated in-memory persistence at port 3025;
  provider keys disabled and database URL deliberately unreachable. Browser
  assertion scripts in `output/playwright/chat-ui-check.js` and
  `chat-ui-safety-check.js` passed: Thai search; all tabs and keyboard selection;
  close/reopen panels; send loading/error/input retention/no replay; newline;
  shared deterministic guide send/reload; upload error/success and identity;
  complete report/print; new/reopened session; mobile menu.
- Conversation menu refresh and Run ID clipboard copy also passed.
- Desktop 1536×1024, tablet 1024×768, mobile 390×844: no horizontal overflow;
  mobile composer bounds fit the panel even with long Thai text and source URLs.
  Screenshots: `output/playwright/chat-ui-desktop.png`, `chat-ui-mobile.png`,
  `chat-ui-long-text-mobile.png`. Visual inspection found/fixed a mobile implicit
  grid column that clipped child content despite no document-level overflow.
- Failed/unlinked runs and zero metrics remain visible. HTML is literal text;
  `javascript:` sources stay inert text. Missing per-step timing/source scores
  and input/output token splits are labeled rather than fabricated.
- `graphify update .`: AST refresh passed, no LLM calls.

Real database/provider UAT, device keyboard/IME, LINE delivery, commit/push and
deployment were not performed. History search uses list fields and the selected
first question; other sessions have ID/date fallback titles. No unsupported
knowledge/settings navigation, source selection, rename or fake load-more action.

## Comments

2026-10-12: Claimed. Existing dirty work preserved. `jg` produced no output
after a bounded wait and was stopped; targeted source reads and Graphify query
confirmed the workspace and the report caller of RunTrace.

2026-10-12: User authorized Lucide icons. Added `lucide-react`, reused existing
session/send/upload/auth behavior, kept printable report traces complete and
preserved concurrent Admin Workspace/Bot Runs changes. Resolved after local checks.

2026-10-12: Removed the chat-header operational notice and its unused icon import
at the user's request. Source inspection confirms removal; typecheck, source lint
and AST graph refresh passed. No browser rerun or deployment for this copy-only follow-up.

2026-10-12: Unified sidebar width and padding in AdminShell (`w-60 px-4 py-6`, 240px)
across all pages including Web Chat, removing the 196px Web Chat exception.
Typecheck, lint, regressions and AST refresh passed.

2026-10-12: Moved the history open button (`PanelLeftOpen`) to the left of the
chat header before the title, keeping right-side actions focused on Execution Trace.
Typecheck, lint, regressions and AST refresh passed.

2026-10-12: Removed StudyUpload from Web Chat composer in preparation for a dedicated
Knowledge tab. Moved report action to the top header beside New Conversation.
Added New Conversation action directly under search in the history drawer.
Typecheck, lint, regressions and AST refresh passed.

2026-10-12: Removed duplicate New Conversation button from the top header per user
request, keeping a single New Conversation action inside the history drawer.
Typecheck, lint, regressions and AST refresh passed.

2026-10-12: Removed decorative chevron from the "ประวัติการสนทนา" title to avoid user
confusion. Added interactive collapsible toggles to session date groups with dynamic
ChevronDown / ChevronRight icons. Typecheck, lint, regressions and AST refresh passed.
