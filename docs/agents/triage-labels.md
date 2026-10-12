# Triage Roles

For local tickets, optionally record a role as `Triage: <canonical-role>`.
`Status: open|claimed|resolved` tracks execution separately. Existing GitHub
labels use the same names when a remote update is part of the requested task.

| Canonical role    | GitHub label      | Meaning                                   |
| ----------------- | ----------------- | ----------------------------------------- |
| `needs-triage`    | `needs-triage`    | Maintainer needs to evaluate this issue   |
| `needs-info`      | `needs-info`      | Waiting on reporter for more information |
| `ready-for-agent` | `ready-for-agent` | Fully specified, ready for an AFK agent   |
| `ready-for-human` | `ready-for-human` | Requires human implementation             |
| `wontfix`         | `wontfix`         | Will not be actioned                      |

When a skill mentions a canonical role, use the corresponding GitHub label from this table.
