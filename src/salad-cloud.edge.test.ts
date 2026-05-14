import { describe, expect, test } from 'vitest'
import { createSaladCloud } from './provider'

describe('edge runtime compatibility', () => {
  test('generates with fetch, Response, and Web Streams globals', async () => {
    const fetch = async (): Promise<Response> =>
      new Response(
        JSON.stringify({
          id: 'chatcmpl-edge-test',
          object: 'chat.completion',
          created: 1735891200,
          model: 'qwen3.6-35b-a3b',
          choices: [{ index: 0, message: { role: 'assistant', content: 'edge-ok' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )

    const model = createSaladCloud({ apiKey: 'test-key', baseURL: 'https://example.test/v1', fetch })('qwen3.6-35b-a3b')
    const result = await model.doGenerate({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Say edge-ok.' }] }],
    })

    expect(result.content).toEqual([{ type: 'text', text: 'edge-ok' }])
  })
})
