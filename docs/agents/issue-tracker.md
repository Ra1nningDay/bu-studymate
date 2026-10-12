# Issue Tracker: Local Markdown

Issues and specs for new repository work live in `.scratch/`. The authoritative
status index is [.scratch/README.md](../../.scratch/README.md).

## Layout and States

- One effort per `.scratch/<effort>/` directory.
- Use `spec.md` for feature requirements or `plan.md` for bounded research/documentation work.
- Use one ticket per `issues/NN-<slug>.md`, numbered from `01`; refer to tickets with an effort prefix to avoid ambiguous numbers.
- Each ticket has `Type:`, `Status: open|claimed|resolved`, `Updated:` and `Blocked by:` near the top, plus scope, acceptance criteria, verification and `## Comments`.
- Append comments/history rather than replacing earlier evidence. Link dependencies to ticket files; work is unblocked when each dependency is resolved.
- Optional triage metadata follows [triage roles](triage-labels.md); triage is separate from ticket status.

## Working with Tickets

1. Read the index and relevant plan/spec and ticket. If none exists for multi-step
   work, create the smallest bounded record and add it to the index.
2. Set `Status: claimed` before working. The first open, unblocked ticket in
   numerical order is the frontier when an effort has ordered tickets.
3. Record changes, commands/results, remaining limits and the next action. Resolve
   only after acceptance criteria pass; otherwise keep it claimed with a blocker.
4. Update the effort record and index when status changes. For abandoned work,
   record the reason/outcome explicitly rather than implying delivery.

When a skill says **publish to the issue tracker**, create a local spec/ticket
and link it from the index. **Fetch the relevant ticket** means read its local
file. Resolve an ambiguous ticket number from the effort context before editing.
For a large exploration, `map.md` may link child tickets and record decisions;
create it only when the work needs a map.

## Existing GitHub Issues

Issues at `Ra1nningDay/bu-studymate` remain external references. Do not infer that
they are migrated, implemented or closed from the local index. When a task names
a GitHub issue, read that issue and link its source in the local ticket; preserve
its requirements and separately record any authorized remote update. This
documentation setup neither imports nor changes remote issues.
