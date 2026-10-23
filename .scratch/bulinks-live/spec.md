# BU Links live lookup

Updated: 2026-10-24
Status: planned (nothing implemented); see [the plan](../../docs/superpowers/plans/2026-10-24-bulinks-live-lookup.md)

## What the user asked for

When the knowledge base has no answer, or its data is too old for the current date, the agent should find
the relevant service pages on `https://bulinks.bu.ac.th/` and send their links to the student, and it should
be able to give basic news. Announcements must be seen immediately ("เห็นประกาศล่าสุดทันที"), so this is a
live lookup at question time, not a periodic sync into the RAG corpus. The user did not say whether news and
the calendar need the same freshness; the narrowed request is read as: announcements live, links and news basic.

## Findings that shape the design (inspected 2026-10-24, read-only)

- `bulinks.bu.ac.th` is WordPress. `GET /wp-json/wp/v2/posts` (1,106 posts) and `/pages` (154) are public JSON; RSS and
  Yoast sitemaps exist; `robots.txt` allows all. No HTML scraping is needed for announcements, news or service pages.
- Announcement categories (Thai / English twins): university 1 / 24, student affairs 564 / 566, study abroad
  284 / 280. 649 other posts are old COVID reports. Dates come as `date_gmt`.
- Service pages are duplicated per year (tuition fees 2024, 2025, 2026 share one title) and per language (`/en/`),
  and some page `link` values are outside bu.ac.th (a Google Apps Script URL) or junk ("No Access").
- The calendar uses the `fat-event` plugin (826 events), not exposed through REST. BU NEWS lives on
  `www.bu.ac.th/th/featured-stories/type/5`, not in WordPress. Both are link-only here.

## Decisions

Agreed with the user: live lookup for announcements; link finding for services; basic news.

My calls (flag in the final report): no LLM in this path (titles, dates and links only, so site text cannot inject
instructions and answers are fast); a 20 s cache on latest posts and a 1 h cache on the page list; calendar and BU NEWS
answered with their index link only; bulinks failure falls through to today's web-search fallback; no new env var.

## Non-goals and anti-goals

- No crawler, no indexing into `KnowledgeItem`, no event or BU NEWS parsing, no admin UI.
- Never state a conclusion from a title (for example "classes are online tomorrow"); show the latest titles, dates and
  links and tell the student to open them.
- Never emit a link that is not `https` on a bu.ac.th host.
