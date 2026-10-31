# Model prices and complete usage records

Use verified Standard rates for Luna and Jev, preserve provider-reported cost,
and retain model/step/input/output/cache usage through router, RAG and search.
Show rates and distinguish missing rates from incomplete historical usage.
Do not infer old splits, rewrite saved data, call paid providers or deploy.

1. Price and usage regressions -> demonstrate missing rates/splits before repair.
2. Preserve usage through adapters/orchestration and storage -> focused offline checks.
3. Cost read model and existing UI -> typecheck, lint, graph and responsive fixture checks.

Sources checked 2026-10-31:
- https://developers.openai.com/api/docs/models/gpt-6-luna
- https://developers.openai.com/api/docs/pricing
- https://openrouter.ai/api/v1/models/typesafe/jev-1.13/endpoints
