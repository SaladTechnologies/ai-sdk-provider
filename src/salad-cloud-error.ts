import { APICallError } from '@ai-sdk/provider'

export async function mapSaladCloudError(response: Response): Promise<APICallError> {
  const status = response.status
  const statusText = response.statusText
  const message = await parseErrorMessage(response)
  const isRetryable = status >= 500 || status === 429

  if (status === 429) {
    return new APICallError({
      message: message || `Rate limited (${response.status} ${statusText})`,
      statusCode: status,
      url: response.url,
      requestBodyValues: undefined,
      responseHeaders: undefined,
      responseBody: undefined,
      cause: undefined,
      isRetryable,
      data: undefined,
    })
  }

  return new APICallError({
    message: message || `API call failed (${status} ${statusText})`,
    statusCode: status,
    url: response.url,
    requestBodyValues: undefined,
    responseHeaders: undefined,
    responseBody: undefined,
    cause: undefined,
    isRetryable,
    data: undefined,
  })
}

async function parseErrorMessage(response: Response): Promise<string | undefined> {
  try {
    const contentType = response.headers.get('content-type')
    if (contentType?.includes('application/json')) {
      const body = (await response.clone().json()) as Record<string, unknown>
      if (
        body &&
        typeof body === 'object' &&
        'error' in body &&
        body.error &&
        typeof body.error === 'object' &&
        'message' in body.error &&
        typeof body.error.message === 'string'
      ) {
        return body.error.message
      }
      return undefined
    }
  } catch {
    return undefined
  }
  return undefined
}
