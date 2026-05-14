import { APICallError } from '@ai-sdk/provider'
import { safeParseJSON } from '@ai-sdk/provider-utils'

export async function mapSaladCloudError(response: Response): Promise<APICallError> {
  const status = response.status
  const statusText = response.statusText
  const { body, data, message } = await parseErrorResponse(response)
  const isRetryable = status >= 500 || status === 429
  const responseHeaders = Object.fromEntries(response.headers.entries())

  if (status === 429) {
    return new APICallError({
      message: message || `Rate limited (${response.status} ${statusText})`,
      statusCode: status,
      url: response.url,
      requestBodyValues: undefined,
      responseHeaders,
      responseBody: body,
      cause: undefined,
      isRetryable,
      data,
    })
  }

  return new APICallError({
    message: message || `API call failed (${status} ${statusText})`,
    statusCode: status,
    url: response.url,
    requestBodyValues: undefined,
    responseHeaders,
    responseBody: body,
    cause: undefined,
    isRetryable,
    data,
  })
}

async function parseErrorResponse(response: Response): Promise<{
  body?: string
  data?: unknown
  message?: string
}> {
  try {
    const contentType = response.headers.get('content-type')
    const body = await response.clone().text()

    if (contentType?.includes('json') && body.length > 0) {
      const parsed = await safeParseJSON({ text: body })
      if (!parsed.success) {
        return { body }
      }

      return {
        body,
        data: parsed.value,
        message: getErrorMessage(parsed.value),
      }
    }

    return { body: body.length > 0 ? body : undefined }
  } catch {
    return {}
  }
}

function getErrorMessage(data: unknown): string | undefined {
  if (typeof data !== 'object' || data == null) {
    return undefined
  }

  if ('error' in data && typeof data.error === 'object' && data.error != null) {
    const error = data.error
    if ('message' in error && typeof error.message === 'string') {
      return error.message
    }
  }

  if ('title' in data && typeof data.title === 'string') {
    return data.title
  }

  return undefined
}
