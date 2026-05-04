import {
  combineHeaders,
  createJsonResponseHandler,
  createEventSourceResponseHandler,
  generateId,
  postJsonToApi,
  serializeModelOptions,
  WORKFLOW_DESERIALIZE,
  WORKFLOW_SERIALIZE,
  type FetchFunction,
  type ParseResult,
} from '@ai-sdk/provider-utils'
import { z } from 'zod/v4'
import { saladCloudChatLanguageModelOptions } from './salad-cloud-chat-language-model-options'
import { convertToProviderMessages } from './salad-cloud-convert-chat-messages'

import { convertUsage } from './salad-cloud-convert-usage'
import { mapFinishReason } from './salad-cloud-map-finish-reason'
import { prepareTools } from './salad-cloud-prepare-tools'
import type { SaladCloudChatModelId } from './salad-cloud-chat-language-model-options'
import type {
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4Content,
  LanguageModelV4FinishReason,
  LanguageModelV4GenerateResult,
  LanguageModelV4StreamPart,
  LanguageModelV4StreamResult,
  SharedV4Warning,
} from '@ai-sdk/provider'

type SaladCloudChatConfig = {
  provider: string
  baseURL: string
  headers?: () => Record<string, string | undefined>
  fetch?: FetchFunction
  generateId?: () => string
}

export class SaladCloudChatLanguageModel implements LanguageModelV4 {
  readonly specificationVersion = 'v4'
  readonly modelId: SaladCloudChatModelId
  private readonly config: SaladCloudChatConfig
  private readonly generateId: () => string

  static [WORKFLOW_SERIALIZE](model: SaladCloudChatLanguageModel): {
    modelId: string
    config: Record<string, unknown>
  } {
    return serializeModelOptions({
      modelId: model.modelId,
      config: model.config,
    })
  }

  static [WORKFLOW_DESERIALIZE](options: {
    modelId: SaladCloudChatModelId
    config: SaladCloudChatConfig
  }): SaladCloudChatLanguageModel {
    return new SaladCloudChatLanguageModel(options.modelId, options.config)
  }

  constructor(modelId: SaladCloudChatModelId, config: SaladCloudChatConfig) {
    this.modelId = modelId
    this.config = config
    this.generateId = config.generateId ?? generateId
  }

  get provider(): string {
    return this.config.provider
  }

  async doGenerate(options: LanguageModelV4CallOptions): Promise<LanguageModelV4GenerateResult> {
    const { args, warnings } = await this.getArgs(options)

    const { responseHeaders, value: response } = await postJsonToApi({
      url: `${this.config.baseURL}/chat/completions`,
      headers: combineHeaders(this.config.headers?.(), options.headers),
      body: args,
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
      failedResponseHandler: () => {
        throw new Error('API request failed')
      },
      successfulResponseHandler: createJsonResponseHandler(saladCloudChatResponseSchema),
    })

    const choice = response.choices[0]
    if (!choice) {
      throw new Error('Expected choices to be defined')
    }
    const content: LanguageModelV4Content[] = []

    if (choice.message.content) {
      if (typeof choice.message.content === 'string') {
        content.push({ type: 'text', text: choice.message.content })
      } else if (Array.isArray(choice.message.content)) {
        for (const part of choice.message.content) {
          if (
            typeof part === 'object' &&
            part !== null &&
            'type' in part &&
            part.type === 'text' &&
            typeof part.text === 'string'
          ) {
            content.push({ type: 'text', text: part.text })
          }
        }
      }
    }

    if (choice.message.tool_calls) {
      for (const toolCall of choice.message.tool_calls) {
        content.push({
          type: 'tool-call',
          toolCallId: toolCall.id,
          toolName: toolCall.function.name,
          input: toolCall.function.arguments,
        })
      }
    }

    return {
      content,
      finishReason: mapFinishReason(choice.finish_reason ?? undefined),
      usage: convertUsage(response.usage ?? undefined),
      request: { body: args },
      response: {
        id: response.id ?? undefined,
        modelId: response.model ?? undefined,
        headers: responseHeaders,
        body: response,
      },
      warnings,
    }
  }

  async doStream(options: LanguageModelV4CallOptions): Promise<LanguageModelV4StreamResult> {
    const { args } = await this.getArgs(options)
    const body = { ...args, stream: true }

    const { responseHeaders, value: response } = await postJsonToApi({
      url: `${this.config.baseURL}/chat/completions`,
      headers: combineHeaders(this.config.headers?.(), options.headers),
      body,
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
      failedResponseHandler: () => {
        throw new Error('API request failed')
      },
      successfulResponseHandler: createEventSourceResponseHandler(saladCloudChatChunkSchema),
    })

    let finishReason: LanguageModelV4FinishReason = { unified: 'other', raw: undefined }
    let hasFinish = false

    return {
      stream: response.pipeThrough(
        new TransformStream<ParseResult<z.infer<typeof saladCloudChatChunkSchema>>, LanguageModelV4StreamPart>({
          start(controller): void {
            controller.enqueue({ type: 'text-start', id: '1' })
          },
          transform(chunk, controller): void {
            if (!chunk.success) return

            const value = chunk.value
            const choice = value.choices[0]
            const delta = choice?.delta

            if (delta?.content != null && typeof delta.content === 'string' && delta.content.length > 0) {
              controller.enqueue({ type: 'text-delta', id: '1', delta: delta.content })
            }

            if (delta?.tool_calls != null) {
              for (const toolCall of delta.tool_calls) {
                controller.enqueue({
                  type: 'tool-call',
                  toolCallId: toolCall.id,
                  toolName: toolCall.function.name,
                  input: toolCall.function.arguments,
                })
              }
            }

            if (choice?.finish_reason != null) {
              finishReason = mapFinishReason(choice.finish_reason)
              controller.enqueue({
                type: 'finish',
                finishReason,
                usage: convertUsage(value.usage),
              })
              hasFinish = true
            }
          },
          flush(controller): void {
            if (!hasFinish) {
              controller.enqueue({
                type: 'finish',
                finishReason: { unified: 'other', raw: undefined },
                usage: undefined as never,
              })
            }
          },
        }),
      ),
      request: { body },
      response: { headers: responseHeaders },
    }
  }

  private async getArgs(
    options: LanguageModelV4CallOptions,
  ): Promise<{ args: Record<string, unknown>; warnings: SharedV4Warning[] }> {
    const warnings: SharedV4Warning[] = []
    const optionsObj = (await saladCloudChatLanguageModelOptions.parseAsync(options)) ?? {}

    const tools: Array<{
      type: 'function'
      name: string
      description?: string
    }> =
      options.tools?.map(
        (
          t,
        ): {
          type: 'function'
          name: string
          description?: string
        } =>
          t.type === 'function'
            ? { type: 'function', name: t.name, description: t.description }
            : { type: 'function', name: '' },
      ) ?? []

    const preparedTools =
      tools.length > 0
        ? prepareTools(
            tools.map(
              (
                t,
              ): {
                type: 'function'
                name: string
                description?: string
                parameters?: Record<string, unknown>
              } => ({
                type: 'function',
                name: t.name,
                description: t.description,
                parameters: {} as Record<string, unknown>,
              }),
            ),
            options.toolChoice,
          )
        : { tools: undefined, tool_choice: undefined, warnings: [] }

    const body: Record<string, unknown> = {
      model: this.modelId,
      messages: convertToProviderMessages(options.prompt),
      max_tokens: options.maxOutputTokens,
      temperature: options.temperature,
      top_p: options.topP,
      stop: options.stopSequences,
      seed: options.seed,
      tools: preparedTools?.tools,
      tool_choice: preparedTools?.tool_choice,
      ...optionsObj,
    }

    return { args: body, warnings: [...warnings, ...(preparedTools.warnings ?? [])] }
  }

  get supportedUrls(): Record<string, RegExp[]> {
    return {
      'image/*': [/^https?:\/\/.+/],
    }
  }
}

const chatContentTextSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
})

const saladCloudChatResponseSchema = z.object({
  id: z.string().nullish(),
  created: z.number().nullish(),
  model: z.string().nullish(),
  choices: z.array(
    z.object({
      message: z.object({
        role: z.literal('assistant'),
        content: z.union([z.string(), z.array(chatContentTextSchema)]).nullish(),
        tool_calls: z
          .array(
            z.object({
              id: z.string(),
              type: z.string(),
              function: z.object({ name: z.string(), arguments: z.string() }),
            }),
          )
          .nullish(),
      }),
      finish_reason: z.string().nullish(),
      index: z.number(),
    }),
  ),
  usage: z
    .object({
      prompt_tokens: z.number(),
      completion_tokens: z.number(),
      total_tokens: z.number(),
    })
    .nullish(),
  object: z.string().nullish(),
})

const saladCloudChatChunkSchema = z.object({
  id: z.string().nullish(),
  created: z.number().nullish(),
  model: z.string().nullish(),
  choices: z.array(
    z.object({
      delta: z.object({
        role: z.enum(['assistant']).optional(),
        content: z.union([z.string(), z.array(z.any())]).nullish(),
        tool_calls: z
          .array(
            z.object({
              id: z.string(),
              type: z.string(),
              function: z.object({ name: z.string(), arguments: z.string() }),
            }),
          )
          .nullish(),
      }),
      finish_reason: z.string().nullish(),
      index: z.number(),
    }),
  ),
  usage: z
    .object({
      prompt_tokens: z.number(),
      completion_tokens: z.number(),
      total_tokens: z.number(),
    })
    .nullish(),
})
