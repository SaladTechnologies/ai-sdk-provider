import type { LanguageModelV4FinishReason } from '@ai-sdk/provider'

const mappings: Record<string, LanguageModelV4FinishReason> = {
  stop: { unified: 'stop', raw: 'stop' },
  length: { unified: 'length', raw: 'length' },
  content_filter: { unified: 'content-filter', raw: 'content_filter' },
  tool_calls: { unified: 'tool-calls', raw: 'tool_calls' },
  error: { unified: 'error', raw: 'error' },
}

export function mapFinishReason(raw: string | null | undefined): LanguageModelV4FinishReason {
  if (!raw) return { unified: 'other', raw: undefined }
  return mappings[raw] || { unified: 'other', raw }
}
