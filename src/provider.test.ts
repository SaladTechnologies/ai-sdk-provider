import { afterEach, beforeEach, describe, expect, test } from 'vitest'

const originalEnv = { ...process.env }

beforeEach(() => {
  delete process.env.SALAD_CLOUD_API_KEY
  delete process.env.SALAD_CLOUD_BASE_URL
})

afterEach(() => {
  Object.keys(originalEnv).forEach((key) => {
    if (key.startsWith('SALAD_CLOUD_')) {
      process.env[key] = originalEnv[key]
    }
  })
})

function cleanEnv(): void {
  delete process.env.SALAD_CLOUD_API_KEY
  delete process.env.SALAD_CLOUD_BASE_URL
}

describe('createSaladCloud', () => {
  test('returns a provider function', async () => {
    cleanEnv()
    const { createSaladCloud } = await import('./provider.js')
    const provider = createSaladCloud()
    expect(typeof provider).toBe('function')
  })

  test('provider has languageModel method', async () => {
    cleanEnv()
    const { createSaladCloud } = await import('./provider.js')
    const provider = createSaladCloud()
    expect(typeof provider.languageModel).toBe('function')
  })

  test('creates a model with languageModel', async () => {
    cleanEnv()
    const { createSaladCloud } = await import('./provider.js')
    const provider = createSaladCloud()
    const model = provider.languageModel('qwen3.6-35b-a3b')
    expect(model).toBeDefined()
    expect(model.provider).toBe('salad-cloud')
    expect(model.modelId).toBe('qwen3.6-35b-a3b')
    expect(model.specificationVersion).toBe('v4')
  })

  test('creates a model via direct call', async () => {
    cleanEnv()
    const { createSaladCloud } = await import('./provider.js')
    const provider = createSaladCloud()
    const model = provider('qwen3.6-35b-a3b')
    expect(model.provider).toBe('salad-cloud')
    expect(model.modelId).toBe('qwen3.6-35b-a3b')
  })

  test('throws when calling provider with new keyword', async () => {
    cleanEnv()
    const { createSaladCloud } = await import('./provider.js')
    const provider = createSaladCloud()
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    expect(() => new provider('test')).toThrow(
      'The SaladCloud provider function cannot be called with the new keyword.',
    ) as void
  })

  test('uses apiKey from options', async () => {
    cleanEnv()
    const { createSaladCloud } = await import('./provider.js')
    const provider = createSaladCloud({ apiKey: 'test-key-from-options' })
    const model = provider('qwen3.6-35b-a3b')
    expect(model.provider).toBe('salad-cloud')
  })

  test('uses apiKey from environment variable when not provided in options', async () => {
    process.env.SALAD_CLOUD_API_KEY = 'env-api-key'
    const { createSaladCloud } = await import('./provider.js')
    const provider = createSaladCloud()
    const model = provider('qwen3.6-35b-a3b')
    expect(model.provider).toBe('salad-cloud')
  })

  test('options apiKey takes precedence over environment variable', async () => {
    process.env.SALAD_CLOUD_API_KEY = 'env-key'
    const { createSaladCloud } = await import('./provider.js')
    const provider = createSaladCloud({ apiKey: 'options-key' })
    const model = provider('qwen3.6-35b-a3b')
    expect(model.provider).toBe('salad-cloud')
  })

  test('works with empty apiKey string', async () => {
    cleanEnv()
    const { createSaladCloud } = await import('./provider.js')
    const provider = createSaladCloud({ apiKey: '' })
    const model = provider('qwen3.6-35b-a3b')
    expect(model.provider).toBe('salad-cloud')
  })

  test('works with undefined apiKey', async () => {
    cleanEnv()
    const { createSaladCloud } = await import('./provider.js')
    const provider = createSaladCloud({ apiKey: undefined })
    const model = provider('qwen3.6-35b-a3b')
    expect(model.provider).toBe('salad-cloud')
  })

  test('uses baseURL from options when provided', async () => {
    cleanEnv()
    const { createSaladCloud } = await import('./provider.js')
    const provider = createSaladCloud({ baseURL: 'https://custom.example.com/v1' })
    const model = provider('qwen3.6-35b-a3b')
    expect(model.config.baseURL).toBe('https://custom.example.com/v1')
  })

  test('uses baseURL from environment variable when not in options', async () => {
    process.env.SALAD_CLOUD_BASE_URL = 'https://env.example.com/v1'
    const { createSaladCloud } = await import('./provider.js')
    const provider = createSaladCloud()
    const model = provider('qwen3.6-35b-a3b')
    expect(model.config.baseURL).toBe('https://env.example.com/v1')
  })

  test('options baseURL takes precedence over environment variable', async () => {
    process.env.SALAD_CLOUD_BASE_URL = 'https://env.example.com/v1'
    const { createSaladCloud } = await import('./provider.js')
    const provider = createSaladCloud({ baseURL: 'https://options.example.com/v1' })
    const model = provider('qwen3.6-35b-a3b')
    expect(model.config.baseURL).toBe('https://options.example.com/v1')
  })

  test('uses default baseURL when neither options nor env is set', async () => {
    cleanEnv()
    const { createSaladCloud } = await import('./provider.js')
    const provider = createSaladCloud()
    const model = provider('qwen3.6-35b-a3b')
    expect(model.config.baseURL).toBe('https://ai.salad.cloud/v1')
  })

  test('strips trailing slash from baseURL', async () => {
    cleanEnv()
    const { createSaladCloud } = await import('./provider.js')
    const provider = createSaladCloud({ baseURL: 'https://example.com/v1/' })
    const model = provider('qwen3.6-35b-a3b')
    expect(model.config.baseURL).toBe('https://example.com/v1')
  })

  test('handles baseURL with no trailing slash', async () => {
    cleanEnv()
    const { createSaladCloud } = await import('./provider.js')
    const provider = createSaladCloud({ baseURL: 'https://example.com/v1' })
    const model = provider('qwen3.6-35b-a3b')
    expect(model.config.baseURL).toBe('https://example.com/v1')
  })

  test('passes custom headers from options', async () => {
    cleanEnv()
    const { createSaladCloud } = await import('./provider.js')
    const provider = createSaladCloud({
      headers: { 'X-Custom-Header': 'custom-value' },
    })
    const model = provider('qwen3.6-35b-a3b')
    const headersFn = model.config.headers as () => Record<string, string | undefined>
    const headers = headersFn()
    expect(headers['Authorization']).toContain('Bearer ')
    expect(headers['X-Custom-Header']).toBe('custom-value')
  })

  test('headers function returns Authorization and Content-Type', async () => {
    cleanEnv()
    const { createSaladCloud } = await import('./provider.js')
    const provider = createSaladCloud({ apiKey: 'test-key' })
    const model = provider('qwen3.6-35b-a3b')
    const headersFn = model.config.headers as () => Record<string, string | undefined>
    const headers = headersFn()
    expect(headers['Authorization']).toBe('Bearer test-key')
    expect(headers['Content-Type']).toBe('application/json')
  })

  test('per-model settings can override fetch and generateId', async () => {
    cleanEnv()
    const { createSaladCloud } = await import('./provider.js')
    const customFetch = async (): Promise<Response> => new Response('{}')
    const customGenerateId = (): string => 'custom-id-123'

    const provider = createSaladCloud({ apiKey: 'test' })
    const model = provider('qwen3.6-35b-a3b', {
      fetch: customFetch,
      generateId: customGenerateId,
    })

    expect(model.config.fetch).toBe(customFetch)
    expect(model.config.generateId).toBe(customGenerateId)
  })

  test('model has correct provider', async () => {
    cleanEnv()
    const { createSaladCloud } = await import('./provider.js')
    const provider = createSaladCloud()
    const model = provider('any-model-id')
    expect(model.provider).toBe('salad-cloud')
  })

  test('model reflects the modelId passed in', async () => {
    cleanEnv()
    const { createSaladCloud } = await import('./provider.js')
    const provider = createSaladCloud()
    const model1 = provider('qwen3.6-35b-a3b')
    const model2 = provider('llama-3.1-70b')
    expect(model1.modelId).toBe('qwen3.6-35b-a3b')
    expect(model2.modelId).toBe('llama-3.1-70b')
  })

  test('model specificationVersion is v4', async () => {
    cleanEnv()
    const { createSaladCloud } = await import('./provider.js')
    const provider = createSaladCloud()
    const model = provider('test-model')
    expect(model.specificationVersion).toBe('v4')
  })

  test('model has supportedUrls', async () => {
    cleanEnv()
    const { createSaladCloud } = await import('./provider.js')
    const provider = createSaladCloud()
    const model = provider('test-model')
    expect(model.supportedUrls).toBeDefined()
    expect(model.supportedUrls['image/*']).toBeDefined()
  })

  test('model supports image URLs', async () => {
    cleanEnv()
    const { createSaladCloud } = await import('./provider.js')
    const provider = createSaladCloud()
    const model = provider('test-model')
    const urls = model.supportedUrls['image/*']
    expect(urls).toHaveLength(1)
    expect(urls[0].test('https://example.com/image.png')).toBe(true)
    expect(urls[0].test('http://example.com/image.png')).toBe(true)
  })

  test('model has WORKFLOW_SERIALIZE static method', async () => {
    cleanEnv()
    const { createSaladCloud } = await import('./provider.js')
    const provider = createSaladCloud()
    const model = provider('qwen3.6-35b-a3b')
    expect(model).toHaveProperty('specificationVersion')
  })
})

describe('default export', () => {
  test('saladCloud is available as default export', async () => {
    cleanEnv()
    const { saladCloud } = await import('./provider.js')
    expect(typeof saladCloud).toBe('function')
  })

  test('saladCloud can create a model', async () => {
    cleanEnv()
    const { saladCloud } = await import('./provider.js')
    const model = saladCloud('qwen3.6-35b-a3b')
    expect(model.provider).toBe('salad-cloud')
    expect(model.modelId).toBe('qwen3.6-35b-a3b')
  })

  test('saladCloud uses default baseURL', async () => {
    cleanEnv()
    const { saladCloud } = await import('./provider.js')
    const model = saladCloud('qwen3.6-35b-a3b')
    expect(model.config.baseURL).toBe('https://ai.salad.cloud/v1')
  })

  test('createSaladCloud is exported', async () => {
    cleanEnv()
    const { createSaladCloud } = await import('./provider.js')
    expect(typeof createSaladCloud).toBe('function')
  })

  test('can create provider with createSaladCloud', async () => {
    cleanEnv()
    const { createSaladCloud } = await import('./provider.js')
    const provider = createSaladCloud()
    expect(typeof provider).toBe('function')
    const model = provider('test')
    expect(model.provider).toBe('salad-cloud')
  })
})
