import { withoutTrailingSlash } from '@ai-sdk/provider-utils'
import { SaladCloudChatLanguageModel } from './salad-cloud-chat-language-model'
import type { FetchFunction } from '@ai-sdk/provider-utils'

/**
 * Settings for the SaladCloud provider.
 */
interface SaladCloudProviderSettings {
  /**
   * Base URL for API calls.
   * @default 'https://ai.salad.cloud/v1'
   */
  baseURL?: string

  /**
   * API key for authentication.
   */
  apiKey?: string

  /**
   * Custom headers for requests.
   */
  headers?: Record<string, string>

  /**
   * Custom fetch function.
   */
  fetch?: FetchFunction

  /**
   * Custom ID generation function.
   */
  generateId?: () => string
}

/**
 * Settings for a specific chat model call.
 */
interface SaladCloudChatSettings {
  /**
   * Custom headers for requests.
   */
  headers?: Record<string, string>

  /**
   * Custom fetch function.
   */
  fetch?: FetchFunction

  /**
   * Custom ID generation function.
   */
  generateId?: () => string
}

/**
 * SaladCloud provider interface.
 */
interface SaladCloudProvider {
  (modelId: string, settings?: SaladCloudChatSettings): SaladCloudChatLanguageModel
  languageModel(modelId: string, settings?: SaladCloudChatSettings): SaladCloudChatLanguageModel
}

function createChatModel(
  modelId: string,
  settings: SaladCloudChatSettings = {},
  options: {
    baseURL: string
    apiKey: string
    headers?: Record<string, string>
    generateId?: () => string
    fetch?: FetchFunction
  },
): SaladCloudChatLanguageModel {
  const baseURL = withoutTrailingSlash(
    options.baseURL ?? process.env.SALAD_CLOUD_BASE_URL ?? 'https://ai.salad.cloud/v1',
  )

  return new SaladCloudChatLanguageModel(modelId, {
    provider: 'salad-cloud',
    baseURL: baseURL ?? 'https://ai.salad.cloud/v1',
    headers: () => ({
      Authorization: `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    }),
    fetch: settings.fetch ?? options.fetch,
    generateId: settings.generateId ?? options.generateId,
  })
}

/**
 * Creates a SaladCloud provider instance.
 *
 * @param options - Provider configuration options
 * @returns A provider instance that can create language model instances
 *
 * @example
 * ```ts
 * import { createSaladCloud } from '@saladtechnologies-oss/salad-cloud-ai-sdk';
 *
 * const saladCloud = createSaladCloud({
 *   apiKey: process.env.SALAD_CLOUD_API_KEY,
 * });
 *
 * const model = saladCloud('qwen3.6-35b-a3b');
 * ```
 */
function createSaladCloud(options: SaladCloudProviderSettings = {}): SaladCloudProvider {
  const createModel = (modelId: string, settings: SaladCloudChatSettings = {}): SaladCloudChatLanguageModel =>
    createChatModel(modelId, settings, {
      baseURL: options.baseURL ?? process.env.SALAD_CLOUD_BASE_URL ?? 'https://ai.salad.cloud/v1',
      apiKey: options.apiKey ?? process.env.SALAD_CLOUD_API_KEY ?? '',
      headers: options.headers ?? {},
      generateId: options.generateId,
      fetch: options.fetch,
    })

  const provider: SaladCloudProvider = function (
    modelId: string,
    settings?: SaladCloudChatSettings,
  ): SaladCloudChatLanguageModel {
    if (new.target) {
      throw new Error('The SaladCloud provider function cannot be called with the new keyword.')
    }
    return createModel(modelId, settings)
  }

  provider.languageModel = createModel

  return provider
}

// Export default provider instance
const saladCloud = createSaladCloud()

export { createSaladCloud, saladCloud }
export type { SaladCloudProvider, SaladCloudProviderSettings, SaladCloudChatSettings }
