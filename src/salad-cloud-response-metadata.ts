export function getResponseMetadata(response: { id?: string; model?: string; created?: number; object?: string }): {
  id?: string
  model?: string
  createdAt?: number
} {
  return {
    id: response.id,
    model: response.model,
    createdAt: response.created,
  }
}
