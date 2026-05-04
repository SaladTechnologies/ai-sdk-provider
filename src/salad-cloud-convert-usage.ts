import type { LanguageModelV4Usage } from '@ai-sdk/provider'

export function convertUsage(
  usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null | undefined,
): LanguageModelV4Usage {
  return {
    inputTokens: {
      total: usage?.prompt_tokens,
      noCache: undefined,
      cacheRead: undefined,
      cacheWrite: undefined,
    },
    outputTokens: {
      total: usage?.completion_tokens,
      text: undefined,
      reasoning: undefined,
    },
  }
}
