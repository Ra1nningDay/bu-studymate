import { classifyWithAgentRouter } from "@/src/lib/router/agent-router";

interface ProviderResponse {
  output?: any;
  error?: string;
  tokenUsage?: {
    total?: number;
    prompt?: number;
    completion?: number;
  };
}

class AppRouterProvider {
  id() {
    return "bu-studymate:app-router";
  }

  async callApi(prompt: string, context?: any): Promise<ProviderResponse> {
    const message = context?.vars?.message || prompt;
    try {
      const decision = await classifyWithAgentRouter(message);
      return {
        output: decision,
        tokenUsage: decision.usage
          ? {
              total: decision.usage.total_tokens
            }
          : undefined
      };
    } catch (err: any) {
      return {
        error: err?.message || String(err)
      };
    }
  }
}

export default AppRouterProvider;
