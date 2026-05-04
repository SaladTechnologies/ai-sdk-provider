import { z } from 'zod/v4'

const saladCloudChatLanguageModelOptions = z
  .object({
    reasoningEffort: z.enum(['low', 'medium', 'high']).optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().min(1).optional(),
    topP: z.number().min(0).max(1).optional(),
    topK: z.number().int().min(1).optional(),
    frequencyPenalty: z.number().min(-2).max(2).optional(),
    presencePenalty: z.number().min(-2).max(2).optional(),
    seed: z.number().int().optional(),
    responseFormat: z
      .discriminatedUnion('type', [z.object({ type: z.literal('text') }), z.object({ type: z.literal('json_object') })])
      .optional(),
    stopSequences: z.array(z.string()).optional(),
  })
  .default({})

export type SaladCloudChatLanguageModelOptions = z.infer<typeof saladCloudChatLanguageModelOptions>
export type SaladCloudChatModelId = string
export { saladCloudChatLanguageModelOptions }
