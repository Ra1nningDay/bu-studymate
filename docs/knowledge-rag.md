# Campus knowledge: hybrid RAG

Implemented locally, 2026-10-13. [Ticket](../.scratch/knowledge-rag/issues/01-hybrid-knowledge.md)
records checks and deployment boundaries. No owner-approved corpus was supplied;
legacy/demo knowledge is preserved but is not automatically approved or indexed.

## Storage and answering

The existing Supabase PostgreSQL/Prisma connection stores document evidence in
`KnowledgeItem` and bounded passages in `KnowledgeChunk`. The vector extension
is in `public` in the inspected database. Use migrations before the new app code.
There is no separate vector database, Supabase SDK or GraphRAG.

Thai/English `Intl.Segmenter` word tokens feed PostgreSQL `simple` full-text
search with a GIN index. This is PostgreSQL full-text ranking, not BM25.
Query embeddings use `text-embedding-3-small`, 1536 dimensions, through the
existing server-side `OPENAI_API_KEY`. The query and passages use the same model.

When eligible evidence and conversation history exist, Query Rewrite first uses
the existing `OPENAI_MODEL` to turn the latest follow-up into a standalone search
query. For example, after a Wi-Fi registration question, “แล้วใช้กับ iPhone ล่ะ”
can become a Wi-Fi registration query for iPhone. The same rewritten query feeds
embedding, full-text/vector retrieval and reranking; generation still receives
the original question/history. First turns skip rewriting. The model receives
only the last eight messages, at most 1200 Unicode characters each, as untrusted
topic context. The prompt preserves the latest question's constraints and
instructs the model not to import asserted facts from history or change topics.
This instruction is not proof of semantic fidelity; evaluate topic drift and
Thai/English follow-ups with approved questions before claiming quality gains.

Rewrite makes one extra Chat Completions call with a ten-second timeout and a
2048-token completion limit. Invalid/empty output, queries exceeding 7500 UTF-8
bytes, refusal, truncation, missing credentials and provider errors fall back to
the original question. There is no rewrite retry or additional provider.

Exact cosine search and keyword search each select at most 20 candidates;
RRF (constant 60) merges ranks into at most 40 candidates. An LLM reranker using
the existing `OPENAI_MODEL` and `OPENAI_API_KEY` selects and orders at most five
original passages before generation. It makes one extra Chat Completions call
when at least two candidates exist, with a ten-second timeout and a 2048-token
completion limit. Structured output uses the
[OpenAI JSON schema contract](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=chat);
server checks enforce exactly the requested count of distinct supplied IDs.
Refusal, truncation, invalid IDs/output, missing credentials and provider failure
preserve RRF Top 5. Ranking cannot add evidence or modify its text/source identity.
This is listwise LLM ranking; it does not use a dedicated cross-encoder model.
Cosine similarity
below 0.65 is excluded. These are initial values, not calibrated accuracy claims.
Add HNSW only if measured query latency warrants it.

Both candidate searches exclude unapproved, future, overdue, expired,
changed/unavailable-source and incompatible-model evidence. A content fingerprint
also excludes documents edited outside the ingestion flow. No arbitrary 100-row
limit applies. An embedding outage falls back to approved keyword evidence.
An empty approved corpus skips rewrite, embedding, rerank and internal answer-provider calls.

Generation receives passage IDs, text, official URLs and validity dates. Structured
output cites only supplied IDs; the server builds URLs from selected passages.
Missing/invalid citations, insufficient evidence and provider failures are misses
and retain the existing fresh-info fallback. Citation IDs prove source membership,
not semantic entailment or current factual correctness. The existing web-search
fallback still relies primarily on model instructions about official BU sources;
this task does not implement a trusted live BU navigator. Web/LINE replies and
run/message metadata preserve sources. Token totals include reported rewrite
usage (including rejected output), query embeddings, reported rerank usage
(including rejected rankings) and answer generation.
New knowledge runs record Query Rewrite → Hybrid Retrieval → RRF Fusion →
Reranker → LLM Generation → Output in the existing execution log. Web Chat shows
short summaries, status and measured duration, with expandable original/rewritten
queries, keyword/vector counts/ranks, RRF/cosine values, candidate passages and
selected ranks. RRF executes in the same SQL call as retrieval and has no separate
measured duration. Hybrid Retrieval includes query embedding and that SQL call;
Output measures answer/citation formatting, not channel delivery. Reranking gives
an order, not a relevance score. Generation's chunks are context, while the existing
Sources list contains final answer citations. Report chunks open by default.

These bounded evidence snapshots are stored in existing authenticated run JSON;
no schema migration or new model call is required. Old runs keep their original
logs; their missing telemetry is not reconstructed. Trace metadata is validated
when reading it, with malformed details omitted while legacy actions remain.
The execution trace reports rewrite/rerank `applied`, `fallback` or `skipped`, plus
provider model and reported tokens when available. Tokens from requests without a valid usage response
cannot be counted locally. Rewrite and larger ranking prompts add latency and provider cost;
real-corpus retrieval/answer quality remains to be calibrated.

## Reviewed import

Authenticated admins can also use **Knowledge** at `/admin/knowledge` to search,
inspect, add/review and edit individual articles. Its source snapshot button and
save operation reuse the same safe fetcher and ingestion below. Editing keeps
the existing title and ID; creating rejects duplicate titles. The form accepts
Bangkok dates, requires explicit review confirmation and retains input on failure.
The selected article's source check uses the same checker without renewing approval.
The UI does not import files or approve legacy data automatically.

```powershell
pnpm knowledge:source https://faq.bu.ac.th/wordpress/bu-mobile/
pnpm knowledge:import C:\path\to\reviewed-knowledge.json
pnpm knowledge:check
```

`knowledge:source` reads an official source and prints its SHA-256 snapshot hash.
After reviewing the actual page and the proposed answer text, prepare a JSON array:

```json
[
  {
    "title": "Approved topic title",
    "category": "IT Support",
    "content": "The actual reviewed answer text goes here.",
    "keywords": ["wifi", "ไวไฟ"],
    "sourceUrl": "https://faq.bu.ac.th/wordpress/bu-mobile/",
    "sourceHash": "REPLACE_WITH_THE_ACTUAL_64_CHARACTER_SHA256",
    "verifiedBy": "Actual reviewer or owning unit",
    "verifiedAt": "2026-10-13T09:00:00+07:00",
    "reviewAfter": "2026-11-13T09:00:00+07:00"
  }
]
```

This is a shape example, not an importable approved record. Choose review dates
based on the information's volatility. Add optional `validFrom` and `validUntil`
for term-specific policies/deadlines. Dates include a timezone. Imports reject
future approval, overdue review, missing attribution, malformed source hashes,
unofficial URLs and duplicate titles. Manifest approval is an operator assertion;
the command does not authenticate the named reviewer. Keep manifests private
when they contain personal information; never commit credentials.

The importer verifies the current source snapshot, segments long text into
passages of at most 1200 Unicode characters, prepares embeddings, then atomically
replaces that document and all its passages. Unchanged indexed text/source identity
reuses embeddings. Older approvals cannot replace newer records; changed content
requires a newer approval. Each document is a transaction: a later manifest item
can fail after earlier items succeeded. Inspect the result and rerun safely.
Failed preparation or transaction leaves the previous document intact.

Source requests allow only HTTPS `bu.ac.th` and its subdomains, reject credentials,
ports, fragments and non-public DNS results, pin DNS addresses for TLS requests,
and revalidate redirects. Limits: eight seconds including DNS, three redirects,
two MiB per source. HTML and files are compared as raw bytes; the importer accepts
reviewed extracted text, not automatic HTML/PDF extraction or OCR.

## Recurring freshness checks

`pnpm knowledge:check` checks the 20 least recently checked approved documents and
returns a failing exit status when a source needs attention or review is overdue.
The authenticated `/api/knowledge/check` endpoint runs the same checker.
`vercel.json` configures a daily run around 05:00 Bangkok time. To activate it,
deploy to Vercel with a random `CRON_SECRET` of at least 32 characters. The endpoint
is closed when this secret is absent; the schedule is not active merely because
the file exists locally. Other hosts can schedule the CLI command instead.
See [Vercel cron documentation](https://vercel.com/docs/cron-jobs).

Checks record `UNCHANGED`, `CHANGED` or `UNAVAILABLE`, and never move `verifiedAt`
or `reviewAfter`. Changed/unavailable sources are excluded until a successful
matching check or reviewed re-import; overdue evidence always needs a new review.
Raw-byte snapshots are conservative: cosmetic/dynamic page changes can require
unnecessary review. At more than 20 documents, one daily run does not check the
whole corpus every day; increase scheduling frequency or batch coverage when
operational requirements demonstrate the need. No notification integration is
included; review CLI output or cron response/logs for `attentionRequired`.

## FAQ file corpus and action links

Implemented locally, 2026-10-23. [Ticket](../.scratch/knowledge-rag/issues/05-faq-file-import.md)
records checks and limits. The BU FAQ PDF (`FAQ x Website links.pdf`: 205 Q&As and a
15-site website list, 220 items) is imported as `sourceKind = "FILE"` items; no
crawler, LightRAG or RAG-Anything is involved. A FILE item keeps an official
`sourceUrl` (`https://faq.bu.ac.th/wordpress/`) and a `sourceHash` that is the SHA-256 of
the PDF, but import does not fetch a page and `knowledge:check` skips it, so it is never
marked `CHANGED` by a page it does not depend on. Approval is an operator assertion:
`verifiedBy` names the file and `reviewAfter` is six months out; nobody reviews each
item. The `/admin/knowledge` form refuses to create, edit or source-check FILE items;
change them by re-importing.

Transaction links live in `actionLinks` (at most five `{label, url}` per item, HTTPS, no
credentials/port/fragment, hosts: `bu.ac.th` family plus `th-th.facebook.com`,
`login.microsoftonline.com`, `line.me`, `www.youtube.com`). They are not citations and are
not hash-checked. FAQ text refers to them as `ลิงก์ “label”` and contains no URL, because an
answer containing a URL is rejected as a miss. The model sees only the labels; the server
appends a "ลิงก์สำหรับทำรายการ" block built from the links of the evidence the model cited.

Build a manifest from a transcribed source file and the PDF, then import as usual:

```powershell
pnpm knowledge:faq .scratch/faq-import/faq-source.json "C:\path\FAQ x Website links.pdf" > manifest.json
pnpm knowledge:import manifest.json
```

The manifest cap is 300 items. The PDF's text layer drops some Thai marks; the repairs applied
(sara am, `ซ้ำ`, `น้ำ`, `ดาวน์โหลด`) are listed in the ticket. Link reachability was not checked.

## Verification and rollout

```powershell
pnpm test:knowledge
pnpm exec tsx --test lib/knowledge-trace.test.ts src/services/playground.test.ts
pnpm test:knowledge:db
pnpm typecheck
pnpm lint
```

The DB check creates a randomly named `knowledge_rag_test_*` schema in the
configured database, runs synthetic assertions and drops that exact schema.
It prefers `DIRECT_URL`, preserves public knowledge and never calls real models.
Run only where the database role can create/drop that isolated schema.

Before production rollout, use approved real questions/answers to measure
retrieval recall, answer correctness, citation support, abstention, outdated-year
handling, latency and provider costs against the old baseline. Synthetic checks
and successful migration do not prove those quality metrics. Apply migrations,
deploy app code, import reviewed evidence and verify authenticated Web/LINE
behavior in that order. No approved evidence means internal retrieval misses
and uses the existing fallback.

On Windows, a running Next server may lock Prisma's query-engine DLL and make
`pnpm db:generate` fail with EPERM. Stop the relevant dev server before regenerating
in that case; do not kill unrelated Node processes. This task regenerated the
client successfully after restarting only this checkout's dev server, then
verified its login/check routes and database runtime separately.
