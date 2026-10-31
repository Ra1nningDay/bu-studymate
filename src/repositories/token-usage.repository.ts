import { prisma } from "@/lib/prisma";
import { calculateAiCost } from "@/src/config/pricing.config";

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
}

export class TokenUsageRepository {
  async recordUsage(data: CreateAiTokenLogData) {
    const total = data.totalTokens ?? ((data.promptTokens ?? 0) + (data.completionTokens ?? 0));
    const cost = data.costUsd ?? calculateAiCost(data.model, {
      promptTokens: data.promptTokens,
      completionTokens: data.completionTokens,
      cachedTokens: data.cachedTokens,
      totalTokens: total
    }).costUsd;

    return prisma.aiTokenLog.create({
      data: {
        botRunId: data.botRunId ?? undefined,
        provider: data.provider,
        model: data.model,
        step: data.step,
        promptTokens: data.promptTokens ?? 0,
        completionTokens: data.completionTokens ?? 0,
        cachedTokens: data.cachedTokens ?? 0,
        totalTokens: total,
        costUsd: cost
      }
    });
  }

  async recordUsages(items: CreateAiTokenLogData[]) {
    if (!items.length) return;
    const records = items.map((data) => {
      const total = data.totalTokens ?? ((data.promptTokens ?? 0) + (data.completionTokens ?? 0));
      const cost = data.costUsd ?? calculateAiCost(data.model, {
        promptTokens: data.promptTokens,
        completionTokens: data.completionTokens,
        cachedTokens: data.cachedTokens,
        totalTokens: total
      }).costUsd;

      return {
        botRunId: data.botRunId ?? undefined,
        provider: data.provider,
        model: data.model,
        step: data.step,
        promptTokens: data.promptTokens ?? 0,
        completionTokens: data.completionTokens ?? 0,
        cachedTokens: data.cachedTokens ?? 0,
        totalTokens: total,
        costUsd: cost
      };
    });

    return prisma.aiTokenLog.createMany({
      data: records
    });
  }
}

export const tokenUsageRepository = new TokenUsageRepository();
