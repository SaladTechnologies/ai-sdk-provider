import {
  combineHeaders,
  createJsonResponseHandler,
  createEventSourceResponseHandler,
  generateId,
  parseProviderOptions,
  postJsonToApi,
  removeUndefinedEntries,
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
import { mapSaladCloudError } from './salad-cloud-error'
import { mapFinishReason } from './salad-cloud-map-finish-reason'
import { prepareTools } from './salad-cloud-prepare-tools'
import type { SaladCloudChatModelId } from './salad-cloud-chat-language-model-options'
import type {
  APICallError,
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
      failedResponseHandler: saladCloudFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(saladCloudChatResponseSchema),
    })

    const choice = response.choices[0]
    if (!choice) {
      throw new Error('Expected choices to be defined')
    }
    const content: LanguageModelV4Content[] = []
    const reasoningText = getReasoningText(choice.message)

    if (reasoningText != null && reasoningText.length > 0) {
      content.push({ type: 'reasoning', text: reasoningText })
    }

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
    const { args, warnings } = await this.getArgs(options)
    const body = { ...args, stream: true }

    const { responseHeaders, value: response } = await postJsonToApi({
      url: `${this.config.baseURL}/chat/completions`,
      headers: combineHeaders(this.config.headers?.(), options.headers),
      body,
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
      failedResponseHandler: saladCloudFailedResponseHandler,
      successfulResponseHandler: createEventSourceResponseHandler(saladCloudChatChunkSchema),
    })

    let finishReason: LanguageModelV4FinishReason = { unified: 'other', raw: undefined }
    let hasFinish = false
    let textStarted = false
    let textEnded = false
    let reasoningStarted = false
    let reasoningEnded = false
    const toolCalls = new Map<number, StreamingToolCall>()

    const startReasoning = (controller: TransformStreamDefaultController<LanguageModelV4StreamPart>): void => {
      if (!reasoningStarted) {
        controller.enqueue({ type: 'reasoning-start', id: 'reasoning-1' })
        reasoningStarted = true
      }
    }

    const endReasoning = (controller: TransformStreamDefaultController<LanguageModelV4StreamPart>): void => {
      if (reasoningStarted && !reasoningEnded) {
        controller.enqueue({ type: 'reasoning-end', id: 'reasoning-1' })
        reasoningEnded = true
      }
    }

    return {
      stream: response.pipeThrough(
        new TransformStream<ParseResult<z.infer<typeof saladCloudChatChunkSchema>>, LanguageModelV4StreamPart>({
          start(controller): void {
            controller.enqueue({ type: 'stream-start', warnings })
          },
          transform(chunk, controller): void {
            if (!chunk.success) return

            const value = chunk.value
            if (options.includeRawChunks) {
              controller.enqueue({ type: 'raw', rawValue: value })
            }

            const choice = value.choices[0]
            const delta = choice?.delta
            const reasoningDelta = getReasoningText(delta)

            if (reasoningDelta != null && reasoningDelta.length > 0) {
              startReasoning(controller)
              controller.enqueue({ type: 'reasoning-delta', id: 'reasoning-1', delta: reasoningDelta })
            }

            if (delta?.content != null && typeof delta.content === 'string' && delta.content.length > 0) {
              endReasoning(controller)
              if (!textStarted) {
                controller.enqueue({ type: 'text-start', id: '1' })
                textStarted = true
              }
              controller.enqueue({ type: 'text-delta', id: '1', delta: delta.content })
            }

            if (delta?.tool_calls != null) {
              for (const toolCall of delta.tool_calls) {
                processStreamingToolCall(toolCall, toolCalls, controller)
              }
            }

            if (choice?.finish_reason != null) {
              endReasoning(controller)
              if (textStarted && !textEnded) {
                controller.enqueue({ type: 'text-end', id: '1' })
                textEnded = true
              }
              flushStreamingToolCalls(toolCalls, controller)
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
              endReasoning(controller)
              if (textStarted && !textEnded) {
                controller.enqueue({ type: 'text-end', id: '1' })
              }
              flushStreamingToolCalls(toolCalls, controller)
              controller.enqueue({
                type: 'finish',
                finishReason: { unified: 'other', raw: undefined },
                usage: convertUsage(undefined),
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
    const providerOptions =
      (await parseProviderOptions({
        provider: 'salad-cloud',
        providerOptions: options.providerOptions,
        schema: saladCloudChatLanguageModelOptions,
      })) ?? {}

    const tools =
      options.tools?.flatMap((tool) => {
        if (tool.type !== 'function') {
          warnings.push({
            type: 'unsupported',
            feature: 'provider tools',
            details: `Provider tool "${tool.name}" is not supported by SaladCloud.`,
          })
          return []
        }

        return [
          {
            type: 'function' as const,
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema as Record<string, unknown>,
          },
        ]
      }) ?? []

    const preparedTools =
      tools.length > 0
        ? prepareTools(tools, options.toolChoice)
        : { tools: undefined, tool_choice: undefined, warnings: [] }

    const body = removeUndefinedEntries({
      model: this.modelId,
      messages: convertToProviderMessages(options.prompt),
      max_tokens: options.maxOutputTokens,
      temperature: options.temperature,
      top_p: options.topP,
      top_k: options.topK ?? providerOptions.topK,
      frequency_penalty: options.frequencyPenalty,
      presence_penalty: options.presencePenalty,
      stop: options.stopSequences,
      seed: options.seed,
      tools: preparedTools?.tools,
      tool_choice: preparedTools?.tool_choice,
      response_format: mapResponseFormat(options.responseFormat),
      reasoning_effort: providerOptions.reasoningEffort ?? mapReasoning(options.reasoning, warnings),
    })

    return { args: body, warnings: [...warnings, ...(preparedTools.warnings ?? [])] }
  }

  get supportedUrls(): Record<string, RegExp[]> {
    return {
      'image/*': [/^https?:\/\/.+/],
    }
  }
}

async function saladCloudFailedResponseHandler({ response }: { response: Response }): Promise<{ value: APICallError }> {
  return { value: await mapSaladCloudError(response) }
}

type OpenAIResponseFormat =
  | { type: 'json_object' }
  | { type: 'json_schema'; json_schema: { name: string; description?: string; schema: unknown } }

function mapResponseFormat(responseFormat: LanguageModelV4CallOptions['responseFormat']): OpenAIResponseFormat | undefined {
  if (responseFormat == null || responseFormat.type === 'text') {
    return undefined
  }

  if (responseFormat.schema == null) {
    return { type: 'json_object' }
  }

  return {
    type: 'json_schema',
    json_schema: {
      name: responseFormat.name ?? 'response',
      description: responseFormat.description,
      schema: responseFormat.schema,
    },
  }
}

function mapReasoning(
  reasoning: LanguageModelV4CallOptions['reasoning'],
  warnings: SharedV4Warning[],
): 'low' | 'medium' | 'high' | undefined {
  switch (reasoning) {
    case 'low':
    case 'medium':
    case 'high':
      return reasoning
    case 'minimal':
      warnings.push({
        type: 'compatibility',
        feature: 'reasoning',
        details: 'reasoning "minimal" is mapped to SaladCloud reasoning_effort "low".',
      })
      return 'low'
    case 'xhigh':
      warnings.push({
        type: 'compatibility',
        feature: 'reasoning',
        details: 'reasoning "xhigh" is mapped to SaladCloud reasoning_effort "high".',
      })
      return 'high'
    case 'none':
    case 'provider-default':
    case undefined:
      return undefined
  }
}

type StreamingToolCall = {
  id?: string
  name?: string
  input: string
  started: boolean
  ended: boolean
}

type SaladCloudReasoningFields = {
  reasoning_content?: string | null
  reasoning?: string | null
  reasoning_text?: string | null
}

function getReasoningText(value?: SaladCloudReasoningFields | null): string | undefined {
  if (typeof value?.reasoning_content === 'string') {
    return value.reasoning_content
  }

  if (typeof value?.reasoning === 'string') {
    return value.reasoning
  }

  if (typeof value?.reasoning_text === 'string') {
    return value.reasoning_text
  }

  return undefined
}

type SaladCloudChatToolCallDelta = NonNullable<
  NonNullable<z.infer<typeof saladCloudChatChunkSchema>['choices'][number]['delta']['tool_calls']>[number]
>

function processStreamingToolCall(
  toolCall: SaladCloudChatToolCallDelta,
  toolCalls: Map<number, StreamingToolCall>,
  controller: TransformStreamDefaultController<LanguageModelV4StreamPart>,
): void {
  const index = toolCall.index ?? 0
  const state = toolCalls.get(index) ?? { input: '', started: false, ended: false }

  state.id = toolCall.id ?? state.id
  state.name = toolCall.function?.name ?? state.name

  if (state.id != null && state.name != null && !state.started) {
    controller.enqueue({ type: 'tool-input-start', id: state.id, toolName: state.name })
    state.started = true
  }

  const inputDelta = toolCall.function?.arguments
  if (inputDelta != null && inputDelta.length > 0) {
    state.input += inputDelta
    if (state.id != null && state.started) {
      controller.enqueue({ type: 'tool-input-delta', id: state.id, delta: inputDelta })
    }
  }

  toolCalls.set(index, state)
}

function flushStreamingToolCalls(
  toolCalls: Map<number, StreamingToolCall>,
  controller: TransformStreamDefaultController<LanguageModelV4StreamPart>,
): void {
  for (const state of toolCalls.values()) {
    if (state.id == null || state.name == null || state.ended) {
      continue
    }

    if (!state.started) {
      controller.enqueue({ type: 'tool-input-start', id: state.id, toolName: state.name })
    }
    controller.enqueue({ type: 'tool-input-end', id: state.id })
    controller.enqueue({
      type: 'tool-call',
      toolCallId: state.id,
      toolName: state.name,
      input: state.input,
    })
    state.ended = true
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
        reasoning_content: z.string().nullish(),
        reasoning: z.string().nullish(),
        reasoning_text: z.string().nullish(),
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
        reasoning_content: z.string().nullish(),
        reasoning: z.string().nullish(),
        reasoning_text: z.string().nullish(),
        tool_calls: z
          .array(
            z.object({
              index: z.number().optional(),
              id: z.string().optional(),
              type: z.string().optional(),
              function: z.object({ name: z.string().optional(), arguments: z.string().optional() }).optional(),
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
