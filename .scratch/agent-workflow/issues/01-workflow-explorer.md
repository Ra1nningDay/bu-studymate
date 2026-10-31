# agent-workflow-01: Read-only workflow explorer

Type: enhancement
Status: claimed
Updated: 2026-10-31
Blocked by: none

## Scope

Implement the approved explorer using existing saved Bot Runs and shared admin UI.
Preserve all pre-existing dirty work. No commit, push, deployment, migration or
private environment change is authorized.

## Acceptance Criteria

- [ ] Authenticated read-only route and sidebar entry; current source routing map.
- [ ] Select saved run and step; show validated recorded evidence and honest gaps.
- [ ] Date filters, paging and two-way Bot Runs/Trace links preserve scope.
- [ ] Desktop/tablet/mobile, keyboard, legacy, empty and failure states checked.
- [ ] Focused tests, typecheck, lint, production rendering and graph update recorded.

## Verification

2026-10-31 follow-up (full map + recorded timing), local only:
- Map now draws the whole pipeline; nodes light from recorded steps (ran / fallback /
  error / skipped / route chosen but step unrecorded / idle). Legacy runs stay honest.
- Orchestration now records status and `durationMs` for Agent Router Decision, BU Links
  Lookup, Search Fresh Info, general-chat replies, and an Output step for every intent.
  Study Memory / Ticket steps are still untimed (route-level node only).
- `pnpm typecheck` passed; 80 tests (concise-chat, knowledge-rag, chat-latency-sse,
  playground, admin-workspace, knowledge-trace) and 4 agent-workflow tests passed.
- `pnpm lint`: only pre-existing `.scratch/**/*.cjs` require() errors remain.
- Not checked: authenticated browser rendering of the new map, live DB/provider runs.
  Runs saved before this change still show "ไม่ได้บันทึกสถานะ" for those steps.

## Comments

2026-10-31: Claimed following explicit implementation approval. Reuse existing
Bot Run read facade and KnowledgeTraceDetails; no duplicate persistence/query API.

2026-10-31 (node graph): replaced the CSS boxes with `@xyflow/react` + `elkjs`
(`workflow-canvas.tsx`, `workflow-layout.ts`). Topology and run-state derivation live in
`src/presenters/agent-workflow.presenter.ts` and only declare nodes/edges that exist in
`ChatOrchestrationService`, `agent-router.ts`, `KnowledgeService` and `fresh-info.ts`.
Hard guards are folded into the "Guards & Router" node (read from `routerType`).
Checks: `pnpm typecheck`, lint (only pre-existing `.scratch` errors), 88 tests including graph
integrity, run-state derivation and an ELK no-overlap/routing test. Synthetic fixture page
checked in the in-app browser at 1440px (Run Trace, System Architecture, node click →
Inspector); fixture page removed afterwards.
Limits: no authenticated check with real data; no "Running" state because nothing is recorded
live; default fit is small (graph is ~10 layers wide) so zoom/minimap are needed; mobile
not re-checked; study/ticket/chat steps and error runs have no per-step attribution.
