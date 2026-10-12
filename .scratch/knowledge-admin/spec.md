# Knowledge administration

Add `/admin/knowledge` to the existing admin navigation. Authenticated admins can
search and page through campus documents, inspect content and RAG eligibility,
add/review an article, edit an existing article and check its source individually.
Reuse reviewed ingestion, source safeguards, embedding reuse and atomic indexing.
Titles remain fixed when editing because the existing importer keys by title.
No file extraction, bulk import, new schema or new provider is included.

Local checks must cover auth/origin/input boundaries, identity-safe saves,
ingestion failures, eligibility and responsive form/list interactions.

The supplied 2026-10-13 UI reference replaces the initial list/detail styling:
four actual corpus summary cards, category/status/source filters across storage,
paginated table, selectable row and right-side General/Content/Chunks/Usage tabs.
Reuse the emerald shell and existing Web Chat for question testing. Show reviewed
article previews and indexed passages, because original PDF/file storage and
file-size/page-count metadata do not exist in the campus pipeline. Do not invent
processing counts, trend percentages, per-document usage or upload provenance.

The follow-up [bulk ticket](issues/02-bulk-actions.md) adds visible-page checkbox
selection, versioned atomic deletion and common category/keyword replacement.
Existing text/source/review fields remain per-article. Indexed category changes
prepare new embeddings; keyword changes retain vectors. Invalid/stale indexing
must remain excluded. Confirmation precedes deletion; failed actions retain the
selection and form. No implicit selection of the entire corpus is included.
