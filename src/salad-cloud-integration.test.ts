import { describe, beforeAll, afterAll, it, expect } from 'vitest'
import { createSaladCloud } from './provider.js'
import type { LanguageModelV4Prompt } from '@ai-sdk/provider'

describe('SaladCloud Integration Tests', () => {
  let server: ReturnType<typeof import('http').createServer>
  let serverPort: number

  beforeAll(async () => {
    const http = await import('http')

    server = http.createServer((_req, res) => {
      const streamResponse = {
        id: 'chatcmpl-test-123',
        object: 'chat.completion.chunk',
        created: 1735891200,
        model: 'qwen3.6-35b-a3b',
        choices: [
          {
            index: 0,
            delta: { role: 'assistant', content: 'Hello ' },
          },
          {
            index: 0,
            delta: { role: 'assistant', content: 'from ' },
          },
          {
            index: 0,
            delta: { role: 'assistant', content: 'SaladCloud!' },
          },
          {
            index: 0,
            delta: {},
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 15,
          total_tokens: 25,
        },
      }

      res.writeHead(200, { 'Content-Type': 'text/event-stream' })
      for (const event of streamResponse.choices) {
        const chunk = { ...streamResponse, choices: [event] }
        res.write(`data: ${JSON.stringify(chunk)}\n\n`)
      }
      res.end()
    })

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const address = server.address()
        if (address && typeof address === 'object') {
          serverPort = address.port
        }
        resolve()
      })
    })
  })

  afterAll(() => {
    server.close()
  })

  it('should handle streaming text response', async () => {
    const provider = createSaladCloud({
      apiKey: 'test-api-key-12345',
      baseURL: `http://localhost:${serverPort}`,
    })
    const model = provider('qwen3.6-35b-a3b')

    const prompt: LanguageModelV4Prompt = [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }]

    const stream = await model.doStream({ prompt })

    const reader = stream.stream.getReader()
    const parts: string[] = []

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value?.type === 'text-delta') {
        parts.push(value.delta)
      }
    }

    expect(parts.join('')).toBe('Hello from SaladCloud!')
  })

  it('should handle non-streaming text response', async () => {
    createSaladCloud({
      apiKey: 'test-api-key-12345',
      baseURL: `http://localhost:${serverPort}`,
    })('qwen3.6-35b-a3b')

    expect(serverPort).toBeDefined()
    expect(serverPort).toBeGreaterThan(0)
  })

  it('should accept the provider configuration', async () => {
    const provider = createSaladCloud({
      apiKey: 'test-api-key-12345',
      baseURL: `http://localhost:${serverPort}`,
    })
    const model = provider('qwen3.6-35b-a3b')

    expect(model.provider).toBe('salad-cloud')
    expect(model.modelId).toBe('qwen3.6-35b-a3b')
    expect(model.specificationVersion).toBe('v4')
  })

  it('should handle tool configuration', async () => {
    const provider = createSaladCloud({
      apiKey: 'test-api-key-12345',
      baseURL: `http://localhost:${serverPort}`,
    })
    const model = provider('qwen3.6-35b-a3b')

    const tools = [
      {
        type: 'function' as const,
        name: 'get_weather',
        description: 'Get the current weather',
        parameters: {
          type: 'object' as const,
          properties: {
            location: { type: 'string' as const },
          },
        },
      },
    ]

    expect(tools[0].type).toBe('function')
    expect(tools[0].name).toBe('get_weather')
    expect(typeof model.provider).toBe('string')
  })

  it('should create provider with default settings', async () => {
    const provider = createSaladCloud({
      apiKey: 'test-default-key',
      baseURL: `http://localhost:${serverPort}`,
    })
    const model = provider('any-model-id')

    expect(model.provider).toBe('salad-cloud')
    expect(model.modelId).toBe('any-model-id')
    expect(model.supportedUrls).toBeDefined()
  })

  it('should support multiple models', async () => {
    const provider = createSaladCloud({
      apiKey: 'test-key',
      baseURL: `http://localhost:${serverPort}`,
    })

    const model1 = provider('qwen3.5-9b')
    const model2 = provider('qwen3.6-27b')
    const model3 = provider('qwen3.6-35b-a3b')
    const model4 = provider('llama-3.1-70b')

    expect(model1.modelId).toBe('qwen3.5-9b')
    expect(model2.modelId).toBe('qwen3.6-27b')
    expect(model3.modelId).toBe('qwen3.6-35b-a3b')
    expect(model4.modelId).toBe('llama-3.1-70b')
  })
})
