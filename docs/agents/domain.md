# Domain Docs

StudyMate uses a single-context layout:

- [CONTEXT.md](../../CONTEXT.md): glossary, including terms to avoid.
- `architecture-decisions/`: ADRs for actual architectural trade-offs.
- [ARCHITECTURE.md](../../ARCHITECTURE.md): source ownership, flows and technical boundaries.
- [.scratch/README.md](../../.scratch/README.md): work status; linked plans/tickets own scope and verification.

Before domain or architecture work, read the glossary and relevant ADRs. Use
canonical terms in specs, code and reports. Surface a conflict with an ADR
explicitly before changing the decision.

Create ADRs lazily at `architecture-decisions/NNNN-<slug>.md` when a real decision
needs its context, alternatives, status and consequences recorded. If the
directory is absent, proceed. Keep proposed decisions visibly proposed; accepted
decisions still need source/check evidence before claiming implementation.

Keep the glossary about domain language. Put implementation details in
Architecture, UI rules in Design and task history in local tickets. New ADRs use
`architecture-decisions/`, replacing the previous `docs/adr/` convention.
