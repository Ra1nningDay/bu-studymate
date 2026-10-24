# BU Links live lookup

Implemented locally, 2026-10-24 (branch `feat/bulinks-live-lookup`). [Ticket](../.scratch/bulinks-live/issues/01-live-lookup.md)
records checks and limits; [spec](../.scratch/bulinks-live/spec.md) records the decisions. Not deployed.

## What it does

When a student asks for fresh information (`ASK_FRESH_INFO`), or the knowledge base misses an `ASK_BU_INFO` question,
`answerFreshInfoFromVerifiedSources` first calls `buLinksService.lookup` and returns its reply without any model call.
If the lookup returns `null` or throws, the earlier OpenAI web-search fallback runs unchanged.

- Announcement topics return the five latest posts as title, Bangkok date and link, with a note to open the link
  before deciding. The reply never states a conclusion from a title. Triggers are class-suspension signals only:
  `ประกาศ` (not `ประกาศนียบัตร`), `announce`, `suspend`, `เรียนออนไลน์`, `onsite`, `น้ำท่วม`, `ปิดเรียน`, `หยุดเรียน`,
  `งดเรียน`, `เลื่อนสอบ`, and `class(es)` only together with cancel/online wording. Bare `หยุด`, `ออนไลน์`, `online`,
  `cancel` and `class` do not trigger. `ต่างประเทศ` after `นักศึกษา` is not a study-abroad signal; `calendar` after
  `academic ` and `ปฏิทินการศึกษา` are not activities-calendar signals; `events` needs word boundaries.
- Academic-calendar and holiday questions (`ปฏิทินการศึกษา`, `academic calendar`, `วันหยุด`, `holiday`) return `null`
  unless the message also names the activities calendar or events, so the web-search calendar handling in
  `lib/fresh-info.ts` still runs for them.
- A detected topic with no usable result (no posts and no fixed link) falls through to service-page ranking.
- Replies follow the language of the question: Thai if the message has a Thai letter, otherwise English (English
  header, `More:`, footer, services preamble and `en-GB` Bangkok-time dates). Thai copy is unchanged.
- Student affairs and study abroad topics return the latest posts of those categories.
- Calendar and BU NEWS questions return their index link only; no event or story is parsed.
- Any other question is matched against the service page list by title and slug words; up to three pages are returned.
  The same page published per year keeps the year named in the message, else the newest; if a year is named and a
  yearly page group has no page for it, that group is dropped (so `lookup` can return `null` and web search runs).
  Thai questions never get `/en/` pages; English questions prefer `/en/` pages.
- Every link must parse as `https` on a bu.ac.th host (`officialKnowledgeUrlSchema`).

## Sources and category IDs

Public WordPress REST on `https://bulinks.bu.ac.th` (GET only, no credentials, no new environment variable):

| Data | Endpoint | Notes |
|---|---|---|
| Service pages | `/wp-json/wp/v2/pages?per_page=100&page=N` | up to 5 requests; titles `No Access` and non-official links dropped |
| Latest posts | `/wp-json/wp/v2/posts?categories=…&per_page=…&orderby=date&order=desc` | `date_gmt` shown in Bangkok time |

Category IDs are hard-coded in `src/services/bulinks.service.ts`:

| Topic | Thai | English |
|---|---|---|
| University announcements | 1 | 24 |
| Student affairs | 564 | 566 |
| Study abroad | 284 | 280 |

The announcement topic uses university plus student affairs (1, 564 / 24, 566). To find IDs after the site changes,
list `https://bulinks.bu.ac.th/wp-json/wp/v2/categories?per_page=100` (read-only) and update the table in code.

## Caches, timeouts and ranking

- Page list: 1 hour cache, shared in-flight request, last good list served if a refresh fails.
- Latest posts: 20 second cache per category set and limit; a failed fetch is not cached.
- Every request has a 5 second timeout and the header `User-Agent: BU-StudyMate/1.0`.
- Titles are decoded from WordPress HTML and cut at 120 characters.
- Page ranking is idf-weighted word overlap. Constants: `minScore = 2.5`, `relativeCut = 0.6` (share of the best
  score), `minMatched = 2` and `minCoverage = 0.6`. Precision rule: a page needs at least two distinct matched query
  words (one if the query has only one) and the matched words must cover 60% of the query's meaningful words, so one
  common word cannot return a page alone at the real list size (about 150 pages). A named year (`2025`, `2568`) is not
  a matched word; it only selects the yearly copy. Stop words: the question fillers, `การ ศึกษา ปี ครับ ค่ะ นักศึกษา`,
  the segmenter pieces `ที่ ไหน ยัง ไง` (the phrases `ที่ไหน` and `ยังไง` never matched as one word) and the generic
  `หน้า`, `เรียน`.
- Known limits: a filler-heavy question can fall below 60% coverage and goes to web search (the safe direction);
  `ลงทะเบียนออนไลน์ยังไง` still returns the old COVID vaccine-registration pages because they contain `ลงทะเบียน`; a
  one-word match such as "How do I pay tuition online?" returns `null`.

## No-LLM rule and failure behaviour

Site text never reaches a model: titles, dates and links are formatted by `src/presenters/bulinks.presenter.ts`.
`lookup` catches every error and returns `null`, so a bulinks outage, timeout or unexpected response falls through to
web search. While the site is down the page list is retried on every call (no negative cache).

## Verify

`pnpm test:bulinks` (fake fetch, no network). Real-list regression assertions use the snapshot
`lib/fixtures/bulinks-pages.json` (152 titles, slugs and URLs of the public page list, taken 2026-10-24 through
`buLinksClient.listPages()`); refresh it the same way if the site changes. Live read-only checks are in the ticket.
The P1 eval injects a lookup that returns `null`, so it stays offline and does not cover BU Links.
