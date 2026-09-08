# Domain Docs

This repository uses a single-context domain documentation layout.

## Before exploring, read these

- `CONTEXT.md` at the repository root
- Relevant ADRs under `docs/adr/`

If a file or directory does not exist, proceed silently. Domain-modeling skills create them lazily when terminology or decisions are resolved.

## File structure

```text
/
├── CONTEXT.md
├── docs/
│   └── adr/
└── src/
```

## Use the glossary vocabulary

Use domain terms exactly as defined in `CONTEXT.md`. Avoid synonyms explicitly listed under `_Avoid_`.

If a required concept is absent, reconsider whether it belongs to the domain or record the gap for domain modeling.

## Flag ADR conflicts

Surface conflicts with an existing ADR explicitly instead of silently overriding it.
