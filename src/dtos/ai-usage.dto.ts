import { z } from "zod";

const tokens = z.number().int().nonnegative();

// Chat Completions and Responses use different names for the same billing units.
const normalizedUsageSchema = z.object({
  total_tokens: tokens,
  prompt_tokens: tokens.optional(),
  completion_tokens: tokens.optional(),
  cached_tokens: tokens.optional(),
  cost: z.number().finite().nonnegative().optional(),
  web_search_calls: tokens.optional()
});

export const aiTokenUsageSchema = normalizedUsageSchema.extend({
  prompt_tokens_details: z.object({ cached_tokens: tokens.optional() }).optional(),
  input_tokens: tokens.optional(),
  output_tokens: tokens.optional(),
  input_tokens_details: z.object({ cached_tokens: tokens.optional() }).optional(),
}).transform((value): z.infer<typeof normalizedUsageSchema> => ({
  total_tokens: value.total_tokens,
  prompt_tokens: value.prompt_tokens ?? value.input_tokens,
  completion_tokens: value.completion_tokens ?? value.output_tokens,
  cached_tokens: value.cached_tokens ?? value.prompt_tokens_details?.cached_tokens ?? value.input_tokens_details?.cached_tokens,
  cost: value.cost,
  web_search_calls: value.web_search_calls
}));

export type AiTokenUsage = z.infer<typeof aiTokenUsageSchema>;

export interface AiUsageEntry {
  provider: string;
  model: string;
  step: string;
  usage: AiTokenUsage;
}
