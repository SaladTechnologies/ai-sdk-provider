import { loadApiKey, loadOptionalSetting, withoutTrailingSlash } from '@ai-sdk/provider-utils'
import { SaladCloudChatLanguageModel } from './salad-cloud-chat-language-model'
import type { FetchFunction } from '@ai-sdk/provider-utils'

const DEFAULT_BASE_URL = 'https://ai.salad.cloud/v1'

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
    baseURL?: string
    apiKey?: string
    headers?: Record<string, string>
    generateId?: () => string
    fetch?: FetchFunction
  },
): SaladCloudChatLanguageModel {
  const baseURL = loadBaseURL(options.baseURL)

  return new SaladCloudChatLanguageModel(modelId, {
    provider: 'salad-cloud',
    baseURL,
    headers: () => ({
      Authorization: `Bearer ${loadApiKey({
        apiKey: options.apiKey,
        environmentVariableName: 'SALAD_CLOUD_API_KEY',
        description: 'SaladCloud',
      })}`,
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
 * import { createSaladCloud } from '@saladtechnologies-oss/ai-sdk-provider';
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
      baseURL: options.baseURL,
      apiKey: options.apiKey,
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

function loadBaseURL(baseURL?: string): string {
  return (
    withoutTrailingSlash(
      baseURL ??
        loadOptionalSetting({
          settingValue: undefined,
          environmentVariableName: 'SALAD_CLOUD_BASE_URL',
        }),
    ) ?? DEFAULT_BASE_URL
  )
}

// Export default provider instance
const saladCloud = createSaladCloud()

export { createSaladCloud, saladCloud }
export type { SaladCloudProvider, SaladCloudProviderSettings, SaladCloudChatSettings }
