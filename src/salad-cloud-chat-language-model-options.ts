import { z } from 'zod/v4'

const saladCloudChatLanguageModelOptions = z
  .object({
    reasoningEffort: z.enum(['low', 'medium', 'high']).optional(),
    topK: z.number().int().min(1).optional(),
  })
  .default({})

export type SaladCloudChatLanguageModelOptions = z.infer<typeof saladCloudChatLanguageModelOptions>
export type SaladCloudChatModelId = string
export { saladCloudChatLanguageModelOptions }
