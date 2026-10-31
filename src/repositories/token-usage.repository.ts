import { prisma } from "@/lib/prisma";
import { calculateAiCost, calculateSearchCost, PRICING_CHECKED_AT } from "@/src/config/pricing.config";
import type { PrismaClient } from "@prisma/client";

export interface CreateAiTokenLogData {
  botRunId?: string | null;
  provider: string;
  model: string;
  step: "router" | "embedding" | "rerank" | "answer" | "ingestion" | string;
  promptTokens?: number;
  completionTokens?: number;
  cachedTokens?: number;
  totalTokens?: number;
  costUsd?: number;
  webSearchCalls?: number;
}

export class TokenUsageRepository {
  constructor(private db: Pick<PrismaClient, "aiTokenLog"> = prisma) {}

  private recordData(data: CreateAiTokenLogData) {
    const total = data.totalTokens ?? ((data.promptTokens ?? 0) + (data.completionTokens ?? 0));
    const tokenCost = calculateAiCost(data.model, { ...data, totalTokens: total });
    const searchCost = calculateSearchCost(data.model, data.step, data.webSearchCalls);
    const providerCost = data.costUsd != null && Number.isFinite(data.costUsd) && data.costUsd >= 0;
    const cost = providerCost ? data.costUsd! : tokenCost && searchCost !== null ? tokenCost.costUsd + searchCost : null;
    return {
      botRunId: data.botRunId ?? undefined,
      provider: data.provider,
      model: data.model,
      step: data.step,
      promptTokens: data.promptTokens ?? 0,
      completionTokens: data.completionTokens ?? 0,
      cachedTokens: data.cachedTokens ?? 0,
      totalTokens: total,
      webSearchCalls: data.webSearchCalls,
      costUsd: cost,
      costSource: providerCost ? "provider" : cost === null ? null : `estimate:${PRICING_CHECKED_AT}`
    };
  }

  async recordUsage(data: CreateAiTokenLogData) {
    return this.db.aiTokenLog.create({ data: this.recordData(data) });
  }

  async recordUsages(items: CreateAiTokenLogData[]) {
    if (!items.length) return;
    return this.db.aiTokenLog.createMany({ data: items.map(data => this.recordData(data)) });
  }
}

export const tokenUsageRepository = new TokenUsageRepository();
