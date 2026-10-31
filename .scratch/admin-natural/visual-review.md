# Admin visual review

Date: 2026-10-31 (Asia/Bangkok)
Direction: framed-sheet, seed 529173376. No redraws. Brand hue retained;
Noto Sans Thai explicitly loaded as the existing typography was only a fallback
stack. No photographs, illustrations, video, sample production data or additional
dependencies were added to the application.

Idea: StudyMate's recorded conversations, bot runs and support work determine
the screen hierarchy; chrome recedes behind those records.
Face: green brand mark and data hue, Thai/Latin typography, explicit run scope.
Questions: Overview = what needs attention? Bot Runs = which run needs inspection?
Live interaction: existing run selection, search, filters and saved detail views.

## Measurement comparison

Both screens inspected at 1440x900, 768x1024 and 390x844. Findings below are
deduplicated by the inspector; each report lists affected widths.

| Screen | Before FAIL / WARN | Final FAIL / WARN |
|---|---|---|
| Overview | 3 / 3 | 0 / 0 |
| Bot Runs | 3 / 4 | 0 / 0 |

Reports and all screenshots: `output/playwright/natural-admin/before-overview/`,
`before-runs/`, `after-overview/`, `after-runs/`.
Source taste lint: 0 FAIL, 2 WARN. Monospace IDs are permitted by the app-screen
rules; em dashes are the existing truthful missing-value presentation. Neither
warning justifies replacing real missing values or making IDs harder to scan.

## Critique

ROUND 1
Seen in one second: Overview totals and a compact conversation chart.
Idea (one sentence): Stored operations data leads a quiet StudyMate work surface.
Live thing: Run search and selection.
Layout words by section: shell=frame / metrics=strip / trend=plot / intents=list / attention=table / knowledge=counts.
Scores: design 7.0 · usability 6.5 · creativity 6.0 · content 8.0 → overall 6.8, capped at 6.0.
Caps applied: transient low-contrast LINE badge in the first Runs screenshot.
Top three problems (most visible first), each with the screenshot it shows in and the fix:
1. round1-overview/desktop-fold.jpg: short intent content leaves a stretched panel. Use two content-driven columns, placing knowledge below intents.
2. round1-runs/desktop-fold.jpg: LINE text became white on a pale tint during refinement. Use dark green text.
3. round1-overview/mobile-fold.jpg: separate metrics push the chart down. Use a divided two-column strip on phones.

ROUND 2
Seen in one second: Compact totals, with the knowledge and attention answers visible on desktop.
Idea (one sentence): Recorded runs and support work replace decorative dashboard furniture.
Live thing: Filters and selected-run trace inspection.
Layout words by section: shell=frame / metrics=strip / left=trend+attention / right=intents+knowledge / runs=table+detail.
Scores: design 7.5 · usability 7.0 · creativity 6.0 · content 8.0 → overall 7.1.
Caps applied: none under app-screen rules.
Top three problems (most visible first), each with the screenshot it shows in and the fix:
1. after-runs/mobile-page-01.jpg: detail title squeezed by the action cluster. Give identity its own full-width row on phones.
2. after-runs/desktop-fold.jpg: error badge contrast measured 4.3:1. Darken rose text one step.
3. after-runs/mobile-fold.jpg: filters and metrics still precede the list. Preserve the existing workflow in this bounded restyle; a one-pane mobile interaction is a separate redesign, not silently introduced here.

ROUND 3
Seen in one second: Quiet StudyMate administration; totals and records, rather than icon tiles.
Idea (one sentence): Student support and saved bot evidence determine the content and emphasis.
Live thing: Existing page-local search, server filters and selectable run evidence.
Layout words by section: shell=frame / metrics=strip / overview=two-stream / runs=table+detail / phone=stack.
Scores: design 7.5 · usability 7.5 · creativity 6.0 · content 8.0 → overall 7.3 (self-review).
Caps applied: no app inspector FAIL; page-only image/motion requirements do not apply.
Remaining limits:
1. The phone retains the existing stacked list/detail workflow and requires scrolling; it is not a one-pane inbox redesign.
2. Dense run columns scroll inside their table; identity remains pinned and values remain available.
3. Adjacent admin content pages were not visually audited. The shared shell/header/font apply to them too.

## Evidence boundary

The production fixture imports actual application components and replaces only
auth/data reads with synthetic data. Example account: operator@example.test;
Overview counts: 1 conversation, 2 successful runs, 22.65s, 232 knowledge items,
12 materials and 63 chunks. Runs: 25 generated records, one failure, a missing
latency/token record, two models and LINE/web channels. Extra cookie scenarios
exercise zero, multi-intent, populated attention and load-error states. These
values are confined to the ignored fixture and do not replace application data.

No real database/provider UAT, mobile device/IME check, production deployment,
commit or push. Fonts are self-hosted through Next; their initial build requires
font download access. Synthetic route guards do not establish real browser auth;
the existing admin service regressions cover authorization separately.

Concurrent analytics-date controls appear in the final Runs captures. They were
not introduced by this refinement; real date-range query semantics are outside
its synthetic-data checks.
