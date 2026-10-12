# Documentation Workflow Setup

Type: documentation
Status: resolved
Updated: 2026-10-12

## Scope

Adopt architecture/design references, conditional agent context loading, local
Markdown issues/specs and the `architecture-decisions/` ADR convention for
StudyMate. Retain the existing `jg`-first and Graphify discovery rules and the
project's layered architecture. Use `ARCHITECTURE.md` as the architecture filename.

Application implementation, database changes, dependency changes, importing or
closing GitHub issues, commits and deployment are outside this task.

## Steps and Verification

1. Inspect existing guidance, source owners and current UI/configuration.
   Verify: distinguish current working-tree code from plans and runtime proof.
2. Create project-specific Architecture/Design references and local work records;
   update agent, issue and domain guidance.
   Verify: conditional reading, consistent paths/statuses and preserved local rules.
3. Check Markdown links/fences, whitespace and unrelated file hashes.
   Verify: no broken local references, no unrelated edits and recorded limitations.

## Tickets

- [docs-01: Establish the documentation workflow](issues/01-documentation-workflow.md)

## Comments

2026-10-12: Existing `AGENTS.md` already has uncommitted discovery-rule changes;
extend its working-tree version. Existing GitHub guidance is replaced for future
local work; remote issues remain external references. No `docs/adr/` content was
found to migrate. Create ADR files lazily when an actual decision needs recording.
The graph exists, but its wiki index is absent. Query results require source
confirmation, especially inferred edges. The initial broad `jg` search was
interrupted after yielding no output. The bounded retry returned eight reading
leads but reported incomplete discovery (`request-limit` / `resource_limit`).
Graphify query returned orchestration/controller/service relationships; relevant
claims were confirmed in source.

2026-10-12: Completed Architecture/Design, conditional agent context, local issue
conventions, domain ADR paths and triage-role compatibility. Checked nine Markdown
files and 72 local references, balanced fences and trailing whitespace; scoped
`git diff --check` passed. Compared AGENTS against its saved pre-edit working-tree
version to confirm existing coding rules and discovery order were preserved.

The baseline hash comparison matched 131 unrelated files and found six changed
concurrently outside this task's documentation writes; see docs-01. No files were
reverted. Application checks (`typecheck`, `lint`, browser/LINE, database and paid
providers) were not run for this documentation-only task. Graph regeneration was
not run because this task made no code changes. No remote issue update, commit,
push or deployment was performed.
