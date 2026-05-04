import { describe, expect, test } from 'vitest'
import {
  convertToProviderMessages,
  type LanguageModelV4Prompt,
  type LanguageModelV4TextPart,
  type LanguageModelV4FilePart,
  type LanguageModelV4ToolCallPart,
  type LanguageModelV4ToolResultPart,
  type LanguageModelV4ReasoningPart,
} from './salad-cloud-convert-chat-messages'
import { convertUsage } from './salad-cloud-convert-usage'
import { mapSaladCloudError } from './salad-cloud-error'
import { mapFinishReason } from './salad-cloud-map-finish-reason'
import { prepareTools, type OpenAIToolChoice } from './salad-cloud-prepare-tools'
import { getResponseMetadata } from './salad-cloud-response-metadata'

function makeTextPart(text: string): LanguageModelV4TextPart {
  return { type: 'text', text }
}

function makeFilePart(mediaType: string, data: string | Uint8Array): LanguageModelV4FilePart {
  return { type: 'file', mediaType, data }
}

function makeToolCallPart(toolCallId: string, toolName: string, input: unknown): LanguageModelV4ToolCallPart {
  return { type: 'tool-call', toolCallId, toolName, input }
}

function makeReasoningPart(text: string): LanguageModelV4ReasoningPart {
  return { type: 'reasoning', text }
}

describe('mapFinishReason', () => {
  test('maps "stop" to unified stop', () => {
    const result = mapFinishReason('stop')
    expect(result.unified).toBe('stop')
    expect(result.raw).toBe('stop')
  })

  test('maps "length" to unified length', () => {
    const result = mapFinishReason('length')
    expect(result.unified).toBe('length')
    expect(result.raw).toBe('length')
  })

  test('maps "content_filter" to unified content-filter', () => {
    const result = mapFinishReason('content_filter')
    expect(result.unified).toBe('content-filter')
    expect(result.raw).toBe('content_filter')
  })

  test('maps "tool_calls" to unified tool-calls', () => {
    const result = mapFinishReason('tool_calls')
    expect(result.unified).toBe('tool-calls')
    expect(result.raw).toBe('tool_calls')
  })

  test('maps "error" to unified error', () => {
    const result = mapFinishReason('error')
    expect(result.unified).toBe('error')
    expect(result.raw).toBe('error')
  })

  test('handles null input', () => {
    const result = mapFinishReason(null)
    expect(result.unified).toBe('other')
    expect(result.raw).toBe(undefined)
  })

  test('handles undefined input', () => {
    const result = mapFinishReason(undefined)
    expect(result.unified).toBe('other')
    expect(result.raw).toBe(undefined)
  })

  test('handles empty string input', () => {
    const result = mapFinishReason('')
    expect(result.unified).toBe('other')
    expect(result.raw).toBe(undefined)
  })

  test('handles unknown finish reason', () => {
    const result = mapFinishReason('unknown_reason')
    expect(result.unified).toBe('other')
    expect(result.raw).toBe('unknown_reason')
  })

  test('handles whitespace string', () => {
    const result = mapFinishReason(' ')
    expect(result.unified).toBe('other')
    expect(result.raw).toBe(' ')
  })
})

describe('convertUsage', () => {
  test('converts full usage object with all tokens', () => {
    const usage = {
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30,
    }
    const result = convertUsage(usage)
    expect(result.inputTokens.total).toBe(10)
    expect(result.inputTokens.noCache).toBe(undefined)
    expect(result.inputTokens.cacheRead).toBe(undefined)
    expect(result.inputTokens.cacheWrite).toBe(undefined)
    expect(result.outputTokens.total).toBe(20)
    expect(result.outputTokens.text).toBe(undefined)
    expect(result.outputTokens.reasoning).toBe(undefined)
  })

  test('handles null input', () => {
    const result = convertUsage(null)
    expect(result.inputTokens.total).toBe(undefined)
    expect(result.outputTokens.total).toBe(undefined)
  })

  test('handles undefined input', () => {
    const result = convertUsage(undefined)
    expect(result.inputTokens.total).toBe(undefined)
    expect(result.outputTokens.total).toBe(undefined)
  })

  test('handles partial usage with only prompt_tokens', () => {
    const usage = { prompt_tokens: 15 }
    const result = convertUsage(usage)
    expect(result.inputTokens.total).toBe(15)
    expect(result.outputTokens.total).toBe(undefined)
  })

  test('handles partial usage with only completion_tokens', () => {
    const usage = { completion_tokens: 25 }
    const result = convertUsage(usage)
    expect(result.inputTokens.total).toBe(undefined)
    expect(result.outputTokens.total).toBe(25)
  })

  test('handles partial usage with only total_tokens', () => {
    const usage = { total_tokens: 50 }
    const result = convertUsage(usage)
    expect(result.inputTokens.total).toBe(undefined)
    expect(result.outputTokens.total).toBe(undefined)
  })

  test('handles empty object', () => {
    const usage = {}
    const result = convertUsage(usage)
    expect(result.inputTokens.total).toBe(undefined)
    expect(result.outputTokens.total).toBe(undefined)
  })

  test('handles zero token values', () => {
    const usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
    const result = convertUsage(usage)
    expect(result.inputTokens.total).toBe(0)
    expect(result.outputTokens.total).toBe(0)
  })

  test('handles large token values', () => {
    const usage = { prompt_tokens: 100000, completion_tokens: 50000, total_tokens: 150000 }
    const result = convertUsage(usage)
    expect(result.inputTokens.total).toBe(100000)
    expect(result.outputTokens.total).toBe(50000)
  })
})

describe('getResponseMetadata', () => {
  test('extracts all fields', () => {
    const response = {
      id: 'resp-123',
      model: 'qwen3.6-35b-a3b',
      created: 1234567890,
      object: 'chat.completion',
    }
    const result = getResponseMetadata(response)
    expect(result.id).toBe('resp-123')
    expect(result.model).toBe('qwen3.6-35b-a3b')
    expect(result.createdAt).toBe(1234567890)
  })

  test('handles missing id', () => {
    const response = { model: 'qwen3.6-35b-a3b', created: 123 }
    const result = getResponseMetadata(response)
    expect(result.id).toBe(undefined)
    expect(result.model).toBe('qwen3.6-35b-a3b')
    expect(result.createdAt).toBe(123)
  })

  test('handles missing model', () => {
    const response = { id: 'resp-1', created: 123 }
    const result = getResponseMetadata(response)
    expect(result.id).toBe('resp-1')
    expect(result.model).toBe(undefined)
  })

  test('handles missing created', () => {
    const response = { id: 'resp-1', model: 'qwen3.6-35b-a3b' }
    const result = getResponseMetadata(response)
    expect(result.id).toBe('resp-1')
    expect(result.model).toBe('qwen3.6-35b-a3b')
    expect(result.createdAt).toBe(undefined)
  })

  test('handles empty object', () => {
    const result = getResponseMetadata({})
    expect(result.id).toBe(undefined)
    expect(result.model).toBe(undefined)
    expect(result.createdAt).toBe(undefined)
  })

  test('handles null-like values', () => {
    const response = { id: null, model: undefined, created: null }
    const result = getResponseMetadata(response)
    expect(result.id).toBe(null)
    expect(result.model).toBe(undefined)
    expect(result.createdAt).toBe(null)
  })
})

describe('convertToProviderMessages', () => {
  test('converts system message', () => {
    const prompt: LanguageModelV4Prompt = [{ role: 'system', content: 'You are a helpful assistant.' }]
    const result = convertToProviderMessages(prompt)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      role: 'system',
      content: 'You are a helpful assistant.',
    })
  })

  test('skips system message with null content', () => {
    const systemMessage = { role: 'system' as const, content: null }
    const prompt: LanguageModelV4Prompt = [systemMessage]
    const result = convertToProviderMessages(prompt)
    expect(result).toHaveLength(0)
  })

  test('skips system message with empty string content', () => {
    const prompt: LanguageModelV4Prompt = [{ role: 'system', content: '' }]
    const result = convertToProviderMessages(prompt)
    expect(result).toHaveLength(1)
    expect(result[0]?.content).toBe('')
  })

  test('converts user text message', () => {
    const prompt: LanguageModelV4Prompt = [{ role: 'user', content: [makeTextPart('Hello')] }]
    const result = convertToProviderMessages(prompt)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      role: 'user',
      content: 'Hello',
    })
  })

  test('converts user message with multiple text parts (takes first)', () => {
    const prompt: LanguageModelV4Prompt = [
      {
        role: 'user',
        content: [makeTextPart('First'), makeTextPart('Second')],
      },
    ]
    const result = convertToProviderMessages(prompt)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      role: 'user',
      content: 'First',
    })
  })

  test('converts user message with text and image', () => {
    const prompt: LanguageModelV4Prompt = [
      {
        role: 'user',
        content: [makeTextPart('What is this?'), makeFilePart('image/png', '_base64data')],
      },
    ]
    const result = convertToProviderMessages(prompt)
    expect(result).toHaveLength(1)
    expect(result[0]?.role).toBe('user')
    const content = result[0]?.content as Array<{ type: string }>
    expect(content).toHaveLength(2)
    expect(content[0]).toEqual({ type: 'text', text: 'What is this?' })
    expect(content[1]).toEqual({
      type: 'image_url',
      image_url: { url: 'data:image/png;base64,data_base64data' },
    })
  })

  test('converts user message with image only', () => {
    const prompt: LanguageModelV4Prompt = [
      {
        role: 'user',
        content: [makeFilePart('image/jpeg', '_binarydata')],
      },
    ]
    const result = convertToProviderMessages(prompt)
    expect(result).toHaveLength(1)
    const content = result[0]?.content as Array<{ type: string }>
    expect(content).toHaveLength(1)
    expect(content[0]).toEqual({
      type: 'image_url',
      image_url: { url: 'data:image/jpeg;base64,data_binarydata' },
    })
  })

  test('converts user message with no text and no files (empty)', () => {
    const prompt: LanguageModelV4Prompt = [{ role: 'user', content: [] }]
    const result = convertToProviderMessages(prompt)
    expect(result).toHaveLength(0)
  })

  test('converts assistant text message', () => {
    const prompt: LanguageModelV4Prompt = [{ role: 'assistant', content: [makeTextPart('Hello back!')] }]
    const result = convertToProviderMessages(prompt)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      role: 'assistant',
      content: 'Hello back!',
    })
  })

  test('converts assistant tool call message', () => {
    const prompt: LanguageModelV4Prompt = [
      {
        role: 'assistant',
        content: [makeToolCallPart('call-1', 'search', { query: 'test' })],
      },
    ]
    const result = convertToProviderMessages(prompt)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      role: 'assistant',
      content: null,
      tool_calls: [
        {
          id: 'call-1',
          type: 'function',
          function: {
            name: 'search',
            arguments: JSON.stringify({ query: 'test' }),
          },
        },
      ],
    })
  })

  test('converts assistant message with text and tool calls', () => {
    const prompt: LanguageModelV4Prompt = [
      {
        role: 'assistant',
        content: [makeTextPart('Let me search for that.'), makeToolCallPart('call-1', 'search', { query: 'test' })],
      },
    ]
    const result = convertToProviderMessages(prompt)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      role: 'assistant',
      content: 'Let me search for that.',
    })
    expect(result[1]).toMatchObject({
      role: 'assistant',
      content: null,
      tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'search' } }],
    })
  })

  test('converts assistant message with reasoning', () => {
    const prompt: LanguageModelV4Prompt = [
      {
        role: 'assistant',
        content: [makeReasoningPart('I should search for this')],
      },
    ]
    const result = convertToProviderMessages(prompt)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      role: 'assistant',
      content: 'I should search for this',
    })
  })

  test('converts assistant with reasoning and text', () => {
    const prompt: LanguageModelV4Prompt = [
      {
        role: 'assistant',
        content: [makeReasoningPart('Thinking...'), makeTextPart('Answer')],
      },
    ]
    const result = convertToProviderMessages(prompt)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      role: 'assistant',
      content: 'Answer',
    })
    expect(result[1]).toEqual({
      role: 'assistant',
      content: 'Thinking...',
    })
  })

  test('converts tool result message', () => {
    const toolResultPart: LanguageModelV4ToolResultPart = {
      type: 'tool-result',
      toolCallId: 'call-1',
      toolName: 'search',
      output: { type: 'text', value: 'Search results: ...' },
    }
    const prompt: LanguageModelV4Prompt = [{ role: 'tool', content: [toolResultPart] }]
    const result = convertToProviderMessages(prompt)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      role: 'tool',
      content: 'Search results: ...',
      tool_call_id: 'call-1',
    })
  })

  test('converts tool result with json output', () => {
    const toolResultPart: LanguageModelV4ToolResultPart = {
      type: 'tool-result',
      toolCallId: 'call-1',
      toolName: 'get_weather',
      output: { type: 'json', value: { temp: 72 } },
    }
    const prompt: LanguageModelV4Prompt = [{ role: 'tool', content: [toolResultPart] }]
    const result = convertToProviderMessages(prompt)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      role: 'tool',
      content: '',
      tool_call_id: 'call-1',
    })
  })

  test('converts multi-turn conversation', () => {
    const prompt: LanguageModelV4Prompt = [
      { role: 'system', content: 'Be helpful.' },
      { role: 'user', content: [makeTextPart('Hi')] },
      { role: 'assistant', content: [makeTextPart('Hello!')] },
      { role: 'user', content: [makeTextPart('How are you?')] },
    ]
    const result = convertToProviderMessages(prompt)
    expect(result).toHaveLength(4)
    expect(result[0]?.role).toBe('system')
    expect(result[1]?.role).toBe('user')
    expect(result[2]?.role).toBe('assistant')
    expect(result[3]?.role).toBe('user')
  })

  test('handles empty prompt', () => {
    const result = convertToProviderMessages([])
    expect(result).toHaveLength(0)
  })

  test('handles assistant with no text parts (only tool calls)', () => {
    const prompt: LanguageModelV4Prompt = [
      {
        role: 'assistant',
        content: [makeToolCallPart('call-1', 'calculator', { expression: '2+2' })],
      },
    ]
    const result = convertToProviderMessages(prompt)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      role: 'assistant',
      content: null,
      tool_calls: [
        {
          id: 'call-1',
          type: 'function',
          function: { name: 'calculator', arguments: JSON.stringify({ expression: '2+2' }) },
        },
      ],
    })
  })

  test('handles assistant with empty content array', () => {
    const prompt: LanguageModelV4Prompt = [{ role: 'assistant', content: [] }]
    const result = convertToProviderMessages(prompt)
    expect(result).toHaveLength(0)
  })

  test('handles tool result with no toolCallId', () => {
    const toolResultPart: LanguageModelV4ToolResultPart = {
      type: 'tool-result',
      toolCallId: undefined,
      toolName: 'search',
      output: { type: 'text', value: 'result' },
    }
    const prompt: LanguageModelV4Prompt = [{ role: 'tool', content: [toolResultPart] }]
    const result = convertToProviderMessages(prompt)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      role: 'tool',
      content: 'result',
      tool_call_id: undefined,
    })
  })
})

describe('prepareTools', () => {
  test('converts function tools with parameters', () => {
    const tools = [
      {
        type: 'function' as const,
        name: 'get_weather',
        description: 'Get the current weather',
        parameters: {
          type: 'object' as const,
          properties: { location: { type: 'string' } },
        },
      },
    ]
    const result = prepareTools(tools, undefined)
    expect(result.tools).toHaveLength(1)
    expect(result.tools[0]).toEqual({
      type: 'function',
      function: {
        name: 'get_weather',
        description: 'Get the current weather',
        parameters: {
          type: 'object',
          properties: { location: { type: 'string' } },
        },
      },
    })
  })

  test('converts function tools without parameters (defaults to empty object)', () => {
    const tools = [
      {
        type: 'function' as const,
        name: 'ping',
      },
    ]
    const result = prepareTools(tools, undefined)
    expect(result.tools).toHaveLength(1)
    expect(result.tools[0].function.parameters).toEqual({})
  })

  test('converts function tools without description', () => {
    const tools = [
      {
        type: 'function' as const,
        name: 'ping',
        parameters: {},
      },
    ]
    const result = prepareTools(tools, undefined)
    expect(result.tools[0].function.description).toBe(undefined)
  })

  test('handles empty tools array', () => {
    const result = prepareTools([], undefined)
    expect(result.tools).toHaveLength(0)
    expect(result.tool_choice).toBe(undefined)
    expect(result.warnings).toEqual([])
  })

  test('handles multiple tools', () => {
    const tools = [
      { type: 'function' as const, name: 'tool1', parameters: {} },
      { type: 'function' as const, name: 'tool2', parameters: {} },
    ]
    const result = prepareTools(tools, undefined)
    expect(result.tools).toHaveLength(2)
    expect(result.tools[0].function.name).toBe('tool1')
    expect(result.tools[1].function.name).toBe('tool2')
  })

  test('handles undefined toolChoice (tool_choice is undefined)', () => {
    const result = prepareTools([{ type: 'function' as const, name: 'test', parameters: {} }], undefined)
    expect(result.tool_choice).toBe(undefined)
  })

  test('handles toolChoice null (tool_choice is undefined)', () => {
    const result = prepareTools(
      [{ type: 'function' as const, name: 'test', parameters: {} }],
      null as OpenAIToolChoice | null,
    )
    expect(result.tool_choice).toBe(undefined)
  })

  test('handles toolChoice type "auto" (maps to undefined)', () => {
    const result = prepareTools([{ type: 'function' as const, name: 'test', parameters: {} }], { type: 'auto' })
    expect(result.tool_choice).toBe(undefined)
  })

  test('handles toolChoice type "none" (maps to undefined)', () => {
    const result = prepareTools([{ type: 'function' as const, name: 'test', parameters: {} }], { type: 'none' })
    expect(result.tool_choice).toBe(undefined)
  })

  test('handles toolChoice type "required" (maps to undefined)', () => {
    const result = prepareTools([{ type: 'function' as const, name: 'test', parameters: {} }], { type: 'required' })
    expect(result.tool_choice).toBe(undefined)
  })

  test('handles toolChoice type "tool" with toolName', () => {
    const result = prepareTools(
      [
        { type: 'function' as const, name: 'test', parameters: {} },
        { type: 'function' as const, name: 'other', parameters: {} },
      ],
      { type: 'tool', toolName: 'other' },
    )
    expect(result.tool_choice).toEqual({
      type: 'function',
      function: { name: 'other' },
    })
  })

  test('handles toolChoice type "tool" without toolName (maps to undefined)', () => {
    const result = prepareTools([{ type: 'function' as const, name: 'test', parameters: {} }], {
      type: 'tool',
      toolName: '',
    })
    expect(result.tool_choice).toBe(undefined)
  })

  test('returns empty warnings array', () => {
    const result = prepareTools([], undefined)
    expect(result.warnings).toEqual([])
  })
})

describe('mapSaladCloudError', () => {
  async function mockResponse(
    status: number,
    statusText: string,
    body?: Record<string, unknown>,
    contentType: string = 'application/json',
  ): Promise<Response> {
    const bodyStr = body ? JSON.stringify(body) : undefined
    const headers = new Headers()
    headers.set('content-type', contentType)
    return new Response(bodyStr, { status, statusText, headers })
  }

  test('creates retryable error for 429 rate limit', async () => {
    const response = await mockResponse(429, 'Too Many Requests')
    const error = await mapSaladCloudError(response)
    expect(error).toBeInstanceOf(Error)
    expect(error.statusCode).toBe(429)
    expect(error.isRetryable).toBe(true)
    expect(error.message).toContain('Rate limited')
    expect(error.url).toBe('')
  })

  test('creates retryable error for 500 server error', async () => {
    const response = await mockResponse(500, 'Internal Server Error')
    const error = await mapSaladCloudError(response)
    expect(error.statusCode).toBe(500)
    expect(error.isRetryable).toBe(true)
    expect(error.message).toContain('API call failed')
  })

  test('creates retryable error for 503 service unavailable', async () => {
    const response = await mockResponse(503, 'Service Unavailable')
    const error = await mapSaladCloudError(response)
    expect(error.statusCode).toBe(503)
    expect(error.isRetryable).toBe(true)
  })

  test('creates error for 400 bad request (not retryable)', async () => {
    const response = await mockResponse(400, 'Bad Request')
    const error = await mapSaladCloudError(response)
    expect(error.statusCode).toBe(400)
    expect(error.isRetryable).toBe(false)
  })

  test('creates error for 401 unauthorized', async () => {
    const response = await mockResponse(401, 'Unauthorized')
    const error = await mapSaladCloudError(response)
    expect(error.statusCode).toBe(401)
    expect(error.isRetryable).toBe(false)
  })

  test('parses error message from JSON response body', async () => {
    const response = await mockResponse(500, 'Internal Server Error', {
      error: { message: 'Model overload, please try again later.' },
    })
    const error = await mapSaladCloudError(response)
    expect(error.message).toBe('Model overload, please try again later.')
  })

  test('falls back to default message when JSON has no error message', async () => {
    const response = await mockResponse(500, 'Internal Server Error', {
      error: { code: 'some_code' },
    })
    const error = await mapSaladCloudError(response)
    expect(error.message).toContain('API call failed')
  })

  test('falls back to default message for non-JSON response', async () => {
    const response = await mockResponse(500, 'Internal Server Error', undefined, 'text/plain')
    const error = await mapSaladCloudError(response)
    expect(error.message).toContain('API call failed')
  })

  test('handles malformed JSON response gracefully', async () => {
    const headers = new Headers()
    headers.set('content-type', 'application/json')
    const response = new Response('not json {', { status: 500, statusText: 'Internal Server Error', headers })
    const error = await mapSaladCloudError(response)
    expect(error.message).toContain('API call failed')
    expect(error.statusCode).toBe(500)
    expect(error.isRetryable).toBe(true)
  })

  test('uses empty string url when response.url is empty', async () => {
    const response = await mockResponse(400, 'Bad Request')
    const error = await mapSaladCloudError(response)
    expect(error.url).toBe('')
  })
})

describe('SaladCloudChatLanguageModel', () => {
  test('mapFinishReason works for doGenerate', () => {
    expect(mapFinishReason('stop')).toEqual({ unified: 'stop', raw: 'stop' })
    expect(mapFinishReason('tool_calls')).toEqual({ unified: 'tool-calls', raw: 'tool_calls' })
    expect(mapFinishReason('length')).toEqual({ unified: 'length', raw: 'length' })
  })

  test('convertUsage works for doGenerate', () => {
    const usage = convertUsage({
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
    })
    expect(usage.inputTokens.total).toBe(100)
    expect(usage.outputTokens.total).toBe(50)
  })

  test('getResponseMetadata works for doGenerate', () => {
    const metadata = getResponseMetadata({
      id: 'resp-123',
      model: 'model-name',
      created: 1234567890,
    })
    expect(metadata.id).toBe('resp-123')
    expect(metadata.model).toBe('model-name')
    expect(metadata.createdAt).toBe(1234567890)
  })
})
