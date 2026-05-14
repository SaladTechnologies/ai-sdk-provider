import { describe, expect, test } from 'vitest'
import { createSaladCloud } from './provider'
import { convertToProviderMessages } from './salad-cloud-convert-chat-messages'
import { convertUsage } from './salad-cloud-convert-usage'
import { mapSaladCloudError } from './salad-cloud-error'
import { mapFinishReason } from './salad-cloud-map-finish-reason'
import { prepareTools } from './salad-cloud-prepare-tools'
import { getResponseMetadata } from './salad-cloud-response-metadata'
import type {
  LanguageModelV4FilePart,
  LanguageModelV4Prompt,
  LanguageModelV4ReasoningPart,
  LanguageModelV4StreamPart,
  LanguageModelV4TextPart,
  LanguageModelV4ToolCallPart,
  LanguageModelV4ToolResultPart,
} from '@ai-sdk/provider'

function makeTextPart(text: string): LanguageModelV4TextPart {
  return { type: 'text', text }
}

function makeFilePart(mediaType: string, data: LanguageModelV4FilePart['data']): LanguageModelV4FilePart {
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

  test('converts user message with multiple text parts', () => {
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
      content: 'FirstSecond',
    })
  })

  test('converts user message with text and image', () => {
    const prompt: LanguageModelV4Prompt = [
      {
        role: 'user',
        content: [makeTextPart('What is this?'), makeFilePart('image/png', { type: 'data', data: 'base64data' })],
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
      image_url: { url: 'data:image/png;base64,base64data' },
    })
  })

  test('converts user message with image only', () => {
    const prompt: LanguageModelV4Prompt = [
      {
        role: 'user',
        content: [makeFilePart('image/jpeg', { type: 'data', data: 'binarydata' })],
      },
    ]
    const result = convertToProviderMessages(prompt)
    expect(result).toHaveLength(1)
    const content = result[0]?.content as Array<{ type: string }>
    expect(content).toHaveLength(1)
    expect(content[0]).toEqual({
      type: 'image_url',
      image_url: { url: 'data:image/jpeg;base64,binarydata' },
    })
  })

  test('converts user message with image URL', () => {
    const prompt: LanguageModelV4Prompt = [
      {
        role: 'user',
        content: [
          makeTextPart('What is this?'),
          makeFilePart('image/png', { type: 'url', url: new URL('https://example.com/image.png') }),
        ],
      },
    ]
    const result = convertToProviderMessages(prompt)
    expect(result).toHaveLength(1)
    expect(result[0]?.content).toEqual([
      { type: 'text', text: 'What is this?' },
      { type: 'image_url', image_url: { url: 'https://example.com/image.png' } },
    ])
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
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      role: 'assistant',
      content: 'Let me search for that.',
      tool_calls: [
        {
          id: 'call-1',
          type: 'function',
          function: { name: 'search', arguments: JSON.stringify({ query: 'test' }) },
        },
      ],
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
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      role: 'assistant',
      content: 'Thinking...Answer',
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
      content: JSON.stringify({ temp: 72 }),
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
      null as never,
    )
    expect(result.tool_choice).toBe(undefined)
  })

  test('handles toolChoice type "auto"', () => {
    const result = prepareTools([{ type: 'function' as const, name: 'test', parameters: {} }], { type: 'auto' })
    expect(result.tool_choice).toBe('auto')
  })

  test('handles toolChoice type "none"', () => {
    const result = prepareTools([{ type: 'function' as const, name: 'test', parameters: {} }], { type: 'none' })
    expect(result.tool_choice).toBe('none')
  })

  test('handles toolChoice type "required"', () => {
    const result = prepareTools([{ type: 'function' as const, name: 'test', parameters: {} }], { type: 'required' })
    expect(result.tool_choice).toBe('required')
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

  test('parses problem+json title from gateway response body', async () => {
    const body = { status: 503, title: 'Service Unavailable', type: 'about:blank' }
    const response = await mockResponse(503, 'Service Unavailable', body, 'application/problem+json')
    const error = await mapSaladCloudError(response)
    expect(error.message).toBe('Service Unavailable')
    expect(error.statusCode).toBe(503)
    expect(error.isRetryable).toBe(true)
    expect(error.responseBody).toBe(JSON.stringify(body))
    expect(error.data).toEqual(body)
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

  test('doGenerate surfaces mapped SaladCloud error response', async () => {
    const body = { status: 503, title: 'Service Unavailable', type: 'about:blank' }
    const fetch = async (): Promise<Response> =>
      new Response(JSON.stringify(body), {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'content-type': 'application/problem+json' },
      })

    const model = createSaladCloud({ apiKey: 'test-key', baseURL: 'https://example.test/v1', fetch })('qwen3.6-35b-a3b')

    await expect(
      model.doGenerate({
        prompt: [{ role: 'user', content: [{ type: 'text', text: 'Say hello in one sentence.' }] }],
      }),
    ).rejects.toMatchObject({
      message: 'Service Unavailable',
      statusCode: 503,
      isRetryable: true,
      responseBody: JSON.stringify(body),
    })
  })

  test('doGenerate sends clean OpenAI-compatible request body', async () => {
    let capturedBody: Record<string, unknown> | undefined
    const fetch = async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      if (typeof init?.body === 'string') {
        capturedBody = JSON.parse(init.body) as Record<string, unknown>
      }

      return new Response(
        JSON.stringify({
          id: 'chatcmpl-test',
          object: 'chat.completion',
          created: 1735891200,
          model: 'qwen3.6-35b-a3b',
          choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    }

    const model = createSaladCloud({ apiKey: 'test-key', baseURL: 'https://example.test/v1', fetch })('qwen3.6-35b-a3b')

    await model.doGenerate({
      prompt: [{ role: 'user', content: [makeTextPart('What is the weather?')] }],
      maxOutputTokens: 7,
      topP: 0.5,
      topK: 40,
      frequencyPenalty: 0.1,
      presencePenalty: 0.2,
      stopSequences: ['END'],
      seed: 123,
      responseFormat: { type: 'json' },
      reasoning: 'low',
      tools: [
        {
          type: 'function',
          name: 'get_weather',
          description: 'Get weather',
          inputSchema: {
            type: 'object',
            properties: { location: { type: 'string' } },
            required: ['location'],
          },
        },
      ],
      toolChoice: { type: 'required' },
    })

    expect(capturedBody).toMatchObject({
      model: 'qwen3.6-35b-a3b',
      messages: [{ role: 'user', content: 'What is the weather?' }],
      max_tokens: 7,
      top_p: 0.5,
      top_k: 40,
      frequency_penalty: 0.1,
      presence_penalty: 0.2,
      stop: ['END'],
      seed: 123,
      response_format: { type: 'json_object' },
      reasoning_effort: 'low',
      tool_choice: 'required',
      tools: [
        {
          type: 'function',
          function: {
            name: 'get_weather',
            description: 'Get weather',
            parameters: {
              type: 'object',
              properties: { location: { type: 'string' } },
              required: ['location'],
            },
          },
        },
      ],
    })
    expect(capturedBody).not.toHaveProperty('topP')
    expect(capturedBody).not.toHaveProperty('stopSequences')
    expect(capturedBody).not.toHaveProperty('maxOutputTokens')
  })

  test('doGenerate disables Qwen thinking when reasoning is none', async () => {
    let capturedBody: Record<string, unknown> | undefined
    const fetch = async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      if (typeof init?.body === 'string') {
        capturedBody = JSON.parse(init.body) as Record<string, unknown>
      }

      return new Response(
        JSON.stringify({
          id: 'chatcmpl-test',
          object: 'chat.completion',
          created: 1735891200,
          model: 'qwen3.6-35b-a3b',
          choices: [{ index: 0, message: { role: 'assistant', content: '444' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    }

    const model = createSaladCloud({ apiKey: 'test-key', baseURL: 'https://example.test/v1', fetch })('qwen3.6-35b-a3b')

    await model.doGenerate({
      prompt: [{ role: 'user', content: [makeTextPart('What is 12 * 37?')] }],
      reasoning: 'none',
    })

    expect(capturedBody).toMatchObject({
      chat_template_kwargs: { enable_thinking: false },
    })
    expect(capturedBody).not.toHaveProperty('reasoning_effort')
  })

  test('doGenerate keeps SaladCloud thinking at provider default unless reasoning is none', async () => {
    let capturedBody: Record<string, unknown> | undefined
    const fetch = async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      if (typeof init?.body === 'string') {
        capturedBody = JSON.parse(init.body) as Record<string, unknown>
      }

      return new Response(
        JSON.stringify({
          id: 'chatcmpl-test',
          object: 'chat.completion',
          created: 1735891200,
          model: 'qwen3.6-35b-a3b',
          choices: [{ index: 0, message: { role: 'assistant', content: '444' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    }

    const model = createSaladCloud({ apiKey: 'test-key', baseURL: 'https://example.test/v1', fetch })('qwen3.6-35b-a3b')

    await model.doGenerate({
      prompt: [{ role: 'user', content: [makeTextPart('What is 12 * 37?')] }],
      reasoning: 'medium',
    })

    expect(capturedBody).toMatchObject({
      reasoning_effort: 'medium',
    })
    expect(capturedBody).not.toHaveProperty('chat_template_kwargs')
  })

  test('doGenerate returns SaladCloud reasoning content before text content', async () => {
    const fetch = async (): Promise<Response> =>
      new Response(
        JSON.stringify({
          id: 'chatcmpl-test',
          object: 'chat.completion',
          created: 1735891200,
          model: 'qwen3.6-35b-a3b',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                reasoning_content: 'I should answer briefly.',
                content: 'Hello.',
              },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 1, completion_tokens: 4, total_tokens: 5 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )

    const model = createSaladCloud({ apiKey: 'test-key', baseURL: 'https://example.test/v1', fetch })('qwen3.6-35b-a3b')

    const result = await model.doGenerate({
      prompt: [{ role: 'user', content: [makeTextPart('Say hello.')] }],
    })

    expect(result.content).toEqual([
      { type: 'reasoning', text: 'I should answer briefly.' },
      { type: 'text', text: 'Hello.' },
    ])
  })

  test('doStream emits reasoning parts from SaladCloud reasoning deltas', async () => {
    const chunks = [
      {
        id: 'chatcmpl-test',
        object: 'chat.completion.chunk',
        created: 1735891200,
        model: 'qwen3.6-35b-a3b',
        choices: [{ index: 0, delta: { reasoning_content: 'Thinking ' } }],
      },
      {
        id: 'chatcmpl-test',
        object: 'chat.completion.chunk',
        created: 1735891200,
        model: 'qwen3.6-35b-a3b',
        choices: [{ index: 0, delta: { reasoning_content: 'briefly.' } }],
      },
      {
        id: 'chatcmpl-test',
        object: 'chat.completion.chunk',
        created: 1735891200,
        model: 'qwen3.6-35b-a3b',
        choices: [{ index: 0, delta: { content: 'Hello.' } }],
      },
      {
        id: 'chatcmpl-test',
        object: 'chat.completion.chunk',
        created: 1735891200,
        model: 'qwen3.6-35b-a3b',
        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
        usage: { prompt_tokens: 1, completion_tokens: 5, total_tokens: 6 },
      },
    ]
    const fetch = async (): Promise<Response> =>
      new Response(chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join(''), {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      })

    const model = createSaladCloud({ apiKey: 'test-key', baseURL: 'https://example.test/v1', fetch })('qwen3.6-35b-a3b')
    const result = await model.doStream({
      prompt: [{ role: 'user', content: [makeTextPart('Say hello.')] }],
    })

    const parts: LanguageModelV4StreamPart[] = []
    const reader = result.stream.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      parts.push(value)
    }

    expect(parts).toEqual([
      { type: 'stream-start', warnings: [] },
      { type: 'reasoning-start', id: 'reasoning-1' },
      { type: 'reasoning-delta', id: 'reasoning-1', delta: 'Thinking ' },
      { type: 'reasoning-delta', id: 'reasoning-1', delta: 'briefly.' },
      { type: 'reasoning-end', id: 'reasoning-1' },
      { type: 'text-start', id: '1' },
      { type: 'text-delta', id: '1', delta: 'Hello.' },
      { type: 'text-end', id: '1' },
      {
        type: 'finish',
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: convertUsage({ prompt_tokens: 1, completion_tokens: 5, total_tokens: 6 }),
      },
    ])
  })

  test('doStream accumulates streamed tool call input deltas', async () => {
    const chunks = [
      {
        id: 'chatcmpl-test',
        object: 'chat.completion.chunk',
        created: 1735891200,
        model: 'qwen3.6-35b-a3b',
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: 'call-1',
                  type: 'function',
                  function: { name: 'get_weather', arguments: '{"location":"' },
                },
              ],
            },
          },
        ],
      },
      {
        id: 'chatcmpl-test',
        object: 'chat.completion.chunk',
        created: 1735891200,
        model: 'qwen3.6-35b-a3b',
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [{ index: 0, function: { arguments: 'NYC"}' } }],
            },
          },
        ],
      },
      {
        id: 'chatcmpl-test',
        object: 'chat.completion.chunk',
        created: 1735891200,
        model: 'qwen3.6-35b-a3b',
        choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      },
    ]
    const fetch = async (): Promise<Response> =>
      new Response(chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join(''), {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      })

    const model = createSaladCloud({ apiKey: 'test-key', baseURL: 'https://example.test/v1', fetch })('qwen3.6-35b-a3b')
    const result = await model.doStream({
      prompt: [{ role: 'user', content: [makeTextPart('What is the weather?')] }],
    })

    const parts: LanguageModelV4StreamPart[] = []
    const reader = result.stream.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      parts.push(value)
    }

    expect(parts).toContainEqual({ type: 'tool-input-start', id: 'call-1', toolName: 'get_weather' })
    expect(parts).toContainEqual({ type: 'tool-input-delta', id: 'call-1', delta: '{"location":"' })
    expect(parts).toContainEqual({ type: 'tool-input-delta', id: 'call-1', delta: 'NYC"}' })
    expect(parts).toContainEqual({ type: 'tool-input-end', id: 'call-1' })
    expect(parts).toContainEqual({
      type: 'tool-call',
      toolCallId: 'call-1',
      toolName: 'get_weather',
      input: '{"location":"NYC"}',
    })
    expect(parts).toContainEqual({
      type: 'finish',
      finishReason: { unified: 'tool-calls', raw: 'tool_calls' },
      usage: convertUsage({ prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }),
    })
  })
})
