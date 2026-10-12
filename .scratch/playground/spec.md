# StudyMate Admin Playground

Updated: 2026-10-12
Status: verified locally; uncommitted
Ticket: [playground-01](issues/01-admin-playground.md)

User authorized implementation of a non-LINE chat with per-turn trace inspection,
saved-session continuation and whole-conversation reports, based on the local
Socratic Tutor Research Mode interaction. Keep StudyMate's own orchestration and
storage; do not import Tutor's backend or modify its repository.

Use the existing database schema and admin password. Authentication must cover
pages, reports and APIs. Namespace test conversations separately from LINE users.
The UI must state that the configured database/providers and operational writes
are real. Reading sessions/reports must not replay messages or invoke AI.

First version: completed-turn traces only, linked by persisted run ID. Live SSE,
per-step timing, prompt editing and model selection are outside this scope.
