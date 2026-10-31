/**
 * Pricing configurations for AI models and currency exchange rates.
 * Rates are expressed in USD per 1,000,000 tokens (Standard provider billing unit).
 */

export interface ModelPricing {
  promptCostPerMillion: number;
  completionCostPerMillion: number;
  cachedPromptCostPerMillion: number;
}

// Rates as of late 2024 / 2025
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // OpenAI
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

export const DEFAULT_MODEL_PRICING: ModelPricing = {
  promptCostPerMillion: 0.15,
  completionCostPerMillion: 0.60,
  cachedPromptCostPerMillion: 0.075
};

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
export function calculateAiCost(modelName: string, usage: TokenUsageInput): CalculatedCost {
  const normalizedModel = Object.keys(MODEL_PRICING).find(
    (key) => modelName.toLowerCase().includes(key.toLowerCase())
  );
  const pricing = normalizedModel ? MODEL_PRICING[normalizedModel] : DEFAULT_MODEL_PRICING;

  const prompt = Math.max(0, usage.promptTokens ?? 0);
  const completion = Math.max(0, usage.completionTokens ?? 0);
  const cached = Math.max(0, usage.cachedTokens ?? 0);

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
