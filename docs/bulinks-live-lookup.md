# BU Links live lookup

Implemented locally, 2026-10-24 (branch `feat/bulinks-live-lookup`). [Ticket](../.scratch/bulinks-live/issues/01-live-lookup.md)
records checks and limits; [spec](../.scratch/bulinks-live/spec.md) records the decisions. Not deployed.

## What it does

When a student asks for fresh information (`ASK_FRESH_INFO`), or the knowledge base misses an `ASK_BU_INFO` question,
`answerFreshInfoFromVerifiedSources` first calls `buLinksService.lookup` and returns its reply without any model call.
If the lookup returns `null` or throws, the earlier OpenAI web-search fallback runs unchanged.

- Announcement topics (`ประกาศ`, `announce`, online/onsite, flood, closure and similar words) return the five latest
  posts as title, Bangkok date and link, with a note to open the link before deciding. The reply never states a
  conclusion from a title.
- Student affairs and study abroad topics return the latest posts of those categories.
- Calendar and BU NEWS questions return their index link only; no event or story is parsed.
- Any other question is matched against the service page list by title and slug words; up to three pages are returned.
  The same page published per year keeps the year named in the message, else the newest. Thai questions never get
  `/en/` pages; English questions prefer `/en/` pages.
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
- Page ranking is idf-weighted word overlap: `minScore = 2.5`, and a page must reach `relativeCut = 0.6` of the best
  score. Both were tuned on a 15-title fixture; re-check them if real results look wrong.

## No-LLM rule and failure behaviour

Site text never reaches a model: titles, dates and links are formatted by `src/presenters/bulinks.presenter.ts`.
`lookup` catches every error and returns `null`, so a bulinks outage, timeout or unexpected response falls through to
web search. While the site is down the page list is retried on every call (no negative cache).

## Verify

`pnpm test:bulinks` (fake fetch, no network). Live read-only checks are recorded in the ticket.
