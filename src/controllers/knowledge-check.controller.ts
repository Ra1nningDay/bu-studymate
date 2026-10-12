import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "@/src/config/env";
import { knowledgeIngestionService } from "@/src/services/knowledge-ingestion.service";

export class KnowledgeCheckController {
  constructor(private service: Pick<typeof knowledgeIngestionService, "checkSources"> = knowledgeIngestionService) {}

  async check(request: Request) {
    const expected = env.CRON_SECRET ? Buffer.from(`Bearer ${env.CRON_SECRET}`) : null;
    const supplied = Buffer.from(request.headers.get("authorization") ?? "");
    if (!expected || expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
      const results = await this.service.checkSources();
      const attentionRequired = results.some((item) => item.status !== "UNCHANGED" || item.reviewOverdue);
      return NextResponse.json({ results, attentionRequired }, { headers: { "Cache-Control": "no-store" } });
    } catch {
      return NextResponse.json({ error: "Knowledge source check failed" }, { status: 503 });
    }
  }
}

export const knowledgeCheckController = new KnowledgeCheckController();
