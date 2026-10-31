/**
 * Pricing configurations for AI models and currency exchange rates.
 * Rates are expressed in USD per 1,000,000 tokens (Standard provider billing unit).
 */

export interface ModelPricing {
  promptCostPerMillion: number;
  completionCostPerMillion: number;
  cachedPromptCostPerMillion: number;
}

export const PRICING_CHECKED_AT = "2026-10-31";
// Standard, short-context rates. See .scratch/model-costs/plan.md for sources.
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // OpenAI
  "gpt-6-luna": {
    promptCostPerMillion: 0.10,
    completionCostPerMillion: 0.50,
    cachedPromptCostPerMillion: 0.01
  },
  "typesafe/jev-1.13": {
    promptCostPerMillion: 0.042,
    completionCostPerMillion: 0,
    cachedPromptCostPerMillion: 0.042
  },
  "gpt-4o-mini": {
    promptCostPerMillion: 0.15,
    completionCostPerMillion: 0.60,
    cachedPromptCostPerMillion: 0.075
  },
  "gpt-4o": {
    promptCostPerMillion: 2.50,
    completionCostPerMillion: 10.00,
    cachedPromptCostPerMillion: 1.25
  },
  "text-embedding-3-small": {
    promptCostPerMillion: 0.02,
    completionCostPerMillion: 0.0,
    cachedPromptCostPerMillion: 0.02
  },
  "text-embedding-3-large": {
    promptCostPerMillion: 0.13,
    completionCostPerMillion: 0.0,
    cachedPromptCostPerMillion: 0.13
  },

  // Google / OpenRouter
  "gemini-1.5-flash": {
    promptCostPerMillion: 0.075,
    completionCostPerMillion: 0.30,
    cachedPromptCostPerMillion: 0.01875
  },
  "gemini-1.5-pro": {
    promptCostPerMillion: 1.25,
    completionCostPerMillion: 5.00,
    cachedPromptCostPerMillion: 0.3125
  },
  "gemini-2.0-flash": {
    promptCostPerMillion: 0.10,
    completionCostPerMillion: 0.40,
    cachedPromptCostPerMillion: 0.025
  }
};

export function getModelPricing(modelName: string): ModelPricing | null {
  const name = modelName.toLowerCase().replace(/^openai\//, "");
  const key = Object.keys(MODEL_PRICING).find(model => name === model ||
    (name.startsWith(`${model}-`) && /^(?:\d{4}-\d{2}-\d{2}|\d{8})$/.test(name.slice(model.length + 1))));
  return key ? MODEL_PRICING[key] : null;
}

export function calculateSearchCost(model: string, step: string, calls: number | null | undefined): number | null {
  if (step !== "web_search" && step !== "web_search_preview") return 0;
  if (calls == null || !Number.isSafeInteger(calls) || calls < 0) return null;
  if (step === "web_search") return calls * 0.01;
  if (/^(?:openai\/)?(?:gpt-[56](?:[.-]|$)|o[134](?:-|$))/.test(model)) return calls * 0.01;
  if (/^(?:openai\/)?gpt-4o?(?:[.-]|$)/.test(model)) return calls * 0.025;
  return null;
}

export const USD_TO_THB_RATE = 35.0;

export interface TokenUsageInput {
  promptTokens?: number;
  completionTokens?: number;
  cachedTokens?: number;
  totalTokens?: number;
}

export interface CalculatedCost {
  costUsd: number;
  costThb: number;
}

/**
 * Calculates estimated USD and THB cost for given tokens and model name.
 */
export function calculateAiCost(modelName: string, usage: TokenUsageInput): CalculatedCost | null {
  const pricing = getModelPricing(modelName);
  const prompt = usage.promptTokens;
  const completion = usage.completionTokens;
  const cached = usage.cachedTokens ?? 0;
  if (!pricing || prompt == null || completion == null ||
    ![prompt, completion, cached].every(value => Number.isSafeInteger(value) && value >= 0) ||
    cached > prompt || (usage.totalTokens != null && prompt + completion !== usage.totalTokens)) return null;

  // Non-cached prompt tokens
  const nonCachedPrompt = Math.max(0, prompt - cached);

  const promptCost = (nonCachedPrompt / 1_000_000) * pricing.promptCostPerMillion;
  const cachedCost = (cached / 1_000_000) * pricing.cachedPromptCostPerMillion;
  const completionCost = (completion / 1_000_000) * pricing.completionCostPerMillion;

  const totalCostUsd = promptCost + cachedCost + completionCost;
  const totalCostThb = totalCostUsd * USD_TO_THB_RATE;

  return {
    costUsd: totalCostUsd,
    costThb: totalCostThb
  };
}
