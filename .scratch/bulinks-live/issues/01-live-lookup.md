# bulinks-live-01: BU Links live lookup

Type: feature
Status: resolved, 2026-10-24 (local; not merged or deployed)
Updated: 2026-10-24
Blocked by: none

## Scope

Answer fresh-info questions and knowledge misses from `bulinks.bu.ac.th` first (latest announcements live, service page
links, calendar and BU NEWS as links only), with no LLM in that path. No crawler, indexing, event parsing or admin UI.
Spec: [spec.md](../spec.md). Plan: [2026-10-24-bulinks-live-lookup.md](../../../docs/superpowers/plans/2026-10-24-bulinks-live-lookup.md).
Guide: [bulinks-live-lookup.md](../../../docs/bulinks-live-lookup.md).

## Acceptance criteria

- Client for the public WordPress REST API with caches, timeout and official-link filter. Done (`lib/bulinks.ts`).
- Topic detection, page ranking and Thai reply formatting. Done (`src/services/bulinks.service.ts`,
  `src/presenters/bulinks.presenter.ts`).
- `answerFreshInfoFromVerifiedSources` tries the lookup first and keeps web search as fallback; orchestration logs
  `BU Links Lookup`. Done (`lib/fresh-info.ts`, `src/services/chat-orchestration.service.ts`).
- Live read-only smoke and a six-question sample recorded. Done, below.

## Verification

Commits: 866a635 (spec and plan), 0006a3b (client), 917eb5e (service and presenter), 82d1fba (wiring), 93f8ed3 (docs), a29cc88 (final-review fix wave). The counts and ranking constants in the next two bullets are as of 82d1fba; current values are in Comments.

- `pnpm test:bulinks` 16 tests, `pnpm test:concise-chat` 19, `pnpm test:knowledge` 46, `pnpm typecheck`, `pnpm lint`
  passed at 82d1fba; re-run for the documentation commit (see Comments). The tests use fake fetch or an injected lookup.
- Ranking constants: `minScore = 2.5` (absolute) and `relativeCut = 0.6` (share of the best score). The relative cut was
  added because an absolute threshold alone returned graduate tuition pages for the bachelor query. Both were tuned on a
  15-title fixture; the tests exercise `relativeCut` but not `minScore` independently.

### Live read-only smoke and six questions: measured BEFORE the final-review fix wave (commit 93f8ed3); the fix wave changed ranking and topic detection, see Comments

### Live read-only smoke (2026-10-24, Node `fetch`, GET only, project client and service; scratch script deleted)

Node had outbound network. Output not committed.

- `listPages()`: 152 pages in about 2.4 s (cold).
- `latestPosts([1, 564], 5)`: five posts; newest 2026-10-05 (university announcement no. 4, onsite), then 29 Sep, 28 Sep,
  25 Sep 2026 and 28 Nov 2025 (flood relief). Dates are in Bangkok time with Buddhist-era years (th-TH).
- `lookup("ประกาศล่าสุด")`: announcements reply with the five posts, dates, links and the open-the-link note.
- `lookup("ค่าเทอมปริญญาตรี")`: bachelor tuition 2026 pages only (`estimated-total-tuition-fees-2026`, `tuition-fees-2026`;
  no graduate, 2024 or 2025 pages) plus one undergraduate-code-66 installment page. The brief expected one tuition page;
  two sibling 2026 pages with different slugs both survive grouping.
- `lookup("Lost and found")`: `https://bulinks.bu.ac.th/en/lost-and-found-en/` only.
- `lookup("ปฏิทินกิจกรรม")`: `https://bulinks.bu.ac.th/events-calendar/` only.
- Cached lookups took 0-5 ms.

### Six real questions (approximation of orchestration, no database writes)

Not `createBotReply` or the Playground, which persist runs. For each question the real `classifyWithAgentRouter` ran
(Jev router, `routerType: agent_router`, real `OPENAI_API_KEY`); then `ASK_FRESH_INFO` called
`answerFreshInfoFromVerifiedSources`, and `ASK_BU_INFO` called `knowledgeService.answerQuestion` (read-only on the real
corpus, with real embedding, rewrite, rerank and answer calls) and would call `answerFreshInfoFromVerifiedSources` on a
miss. No history, no hard-guard routing and no persistence, so this approximates the orchestration. Six questions, one run
each, are a sample, not a measurement.

| Question | Route (confidence) | Answered by | Result | Link problems |
|---|---|---|---|---|
| ประกาศล่าสุดมีอะไรบ้าง | ASK_FRESH_INFO (1.0) | BU Links | five latest announcements, Bangkok dates, links | none; first title cut at 120 chars with "…" |
| พรุ่งนี้เรียนออนไลน์หรือ onsite | ASK_FRESH_INFO (0.98) | BU Links | same five announcements with the open-the-link note, no conclusion | none; the newest (5 Oct, onsite) is 19 days old, so a student cannot tell it still applies without opening it |
| ค่าเทอมปริญญาตรีปีนี้เท่าไร | ASK_FRESH_INFO (1.0) | BU Links | 3 links: undergraduate installment 2026, estimated-total tuition 2026, tuition-fees 2026 | two near-identical titles; no amount given (links only) |
| Lost and found ที่ไหน | ASK_BU_INFO (0.9) | knowledge base | A6 floor 1 opposite canteen 1, one cited FAQ | no BU Links page link, because the corpus answered first |
| ปฏิทินกิจกรรมเดือนนี้ | ASK_FRESH_INFO (0.98) | BU Links | calendar link only | none; the month is not answered (link-only by design) |
| ลืมรหัสผ่าน BU account ต้องทำยังไง (corpus control) | ASK_BU_INFO (0.89) | knowledge base | steps and two URSA links, knowledge path unchanged | none |

## Known limits

- Topic regexes were narrowed after the final review (see Comments); remaining ambiguity: `เรียนออนไลน์` also matches
  "ลงทะเบียนเรียนออนไลน์", and `exchange` matches "exchange rate".
- The page list refresh retries upstream on every call while bulinks is down (no negative cache; up to 5 requests of 5 s each).
- The P1 eval (`evals/providers/p1-orchestration.ts`) injects a lookup that returns `null`: it stays offline and does
  not cover BU Links.
- Ranking: filler-heavy questions fall below 60% coverage and go to web search; `ลงทะเบียนออนไลน์ยังไง` returns old
  COVID vaccine-registration pages; one-word matches ("How do I pay tuition online?") return `null`.
- Category IDs are hard-coded and may drift; nothing checks that they still exist.
- Calendar and BU NEWS are link-only; no event parsing or month filtering.
- th-TH date formatting depends on the Node ICU build (the smoke printed Buddhist-era years).
- The sample ran once per question with no history; it says nothing about recall or router accuracy. Links were fetched
  by the client but not opened in a browser. No LINE or web channel check, no deployment.
- `announcement` returns university plus student affairs posts (Task 2 decision, to match the tests).

## Comments

- 2026-10-24: Re-run for the documentation commit: `pnpm typecheck`, `pnpm lint` clean; `pnpm test:bulinks` 16/16,
  `pnpm test:knowledge` 46/46, `pnpm test:concise-chat` 19/19; `graphify update .` AST refresh (809 nodes, 1249 edges).
- 2026-10-24: Task 2 added `relativeCut` beyond the single constant planned. The spec's "2026 tuition page only" holds at
  the year level, but two sibling 2026 pages are returned.
- 2026-10-24, final-review fix wave (a29cc88): topic patterns narrowed (`ประกาศนียบัตร`, `ปฏิทินการศึกษา`, bare `หยุด`/`ออนไลน์`/
  `online`/`cancel` no longer trigger; academic-calendar and holiday questions return `null` so web search runs; a topic with
  no usable result falls through to ranking). Ranking now also uses stop words, `minMatched = 2` distinct matched tokens
  and `minCoverage = 0.6` of the question's meaningful tokens (alongside `minScore = 2.5`, `relativeCut = 0.6`), ignores
  year tokens when matching, and drops a page group when the named year has no page. English questions get English copy
  (`en-GB` dates). The P1 eval injects a null lookup. A 152-title snapshot of the real page list is in
  `lib/fixtures/bulinks-pages.json` with regression assertions. Checks after the wave: `pnpm test:bulinks` 23/23,
  `pnpm test:knowledge` 46/46, `pnpm test:concise-chat` 19/19, `pnpm test:openai-params` 3/3, `pnpm typecheck`, `pnpm lint`.
  The scoped re-review judged I1-I4 addressed. Post-wave `lookup("ค่าเทอมปริญญาตรี")` returns the two 2026 bachelor pages
  (no installment page), so the sample row and smoke bullet above are stale on that point.
- Known recall cost of the coverage rule (web search answers instead, which is safe): `ประกันอุบัติเหตุทำยังไง`,
  `ค่าเทอมปริญญาตรีเท่าไหร่`, `ที่จอดรถอยู่ที่ไหน` return no page; "can I take online classes" can still trigger announcements.
  Reachability of the live site, LINE and web channels, and the live miss-to-BU-Links path were not exercised end to end.
