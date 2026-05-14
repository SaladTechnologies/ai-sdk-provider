import { generateText, streamText } from 'ai'
import { describe, expect, test } from 'vitest'
import { createSaladCloud } from './provider'

describe('Vercel AI SDK consumer compatibility', () => {
  test('works with generateText', async () => {
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
          choices: [{ index: 0, message: { role: 'assistant', content: 'Hello from SaladCloud.' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 4, completion_tokens: 5, total_tokens: 9 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    }

    const saladCloud = createSaladCloud({ apiKey: 'test-key', baseURL: 'https://example.test/v1', fetch })
    const result = await generateText({
      model: saladCloud('qwen3.6-35b-a3b'),
      prompt: 'Say hello in one sentence.',
      maxOutputTokens: 20,
    })

    expect(result.text).toBe('Hello from SaladCloud.')
    expect(result.finishReason).toBe('stop')
    expect(capturedBody).toMatchObject({
      model: 'qwen3.6-35b-a3b',
      messages: [{ role: 'user', content: 'Say hello in one sentence.' }],
      max_tokens: 20,
    })
  })

  test('works with streamText', async () => {
    const chunks = [
      {
        id: 'chatcmpl-test',
        object: 'chat.completion.chunk',
        created: 1735891200,
        model: 'qwen3.6-35b-a3b',
        choices: [{ index: 0, delta: { role: 'assistant', content: 'Hello ' } }],
      },
      {
        id: 'chatcmpl-test',
        object: 'chat.completion.chunk',
        created: 1735891200,
        model: 'qwen3.6-35b-a3b',
        choices: [{ index: 0, delta: { content: 'from SaladCloud.' } }],
      },
      {
        id: 'chatcmpl-test',
        object: 'chat.completion.chunk',
        created: 1735891200,
        model: 'qwen3.6-35b-a3b',
        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
        usage: { prompt_tokens: 4, completion_tokens: 5, total_tokens: 9 },
      },
    ]
    const fetch = async (): Promise<Response> =>
      new Response(chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join(''), {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      })

    const saladCloud = createSaladCloud({ apiKey: 'test-key', baseURL: 'https://example.test/v1', fetch })
    const result = streamText({
      model: saladCloud('qwen3.6-35b-a3b'),
      prompt: 'Say hello in one sentence.',
      maxOutputTokens: 20,
    })

    await expect(result.text).resolves.toBe('Hello from SaladCloud.')
  })
})
