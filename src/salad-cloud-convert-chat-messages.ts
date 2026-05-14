import { convertUint8ArrayToBase64 } from '@ai-sdk/provider-utils'
import type {
  LanguageModelV4Prompt,
  LanguageModelV4TextPart,
  LanguageModelV4FilePart,
  LanguageModelV4ToolResultPart,
  LanguageModelV4ToolResultOutput,
} from '@ai-sdk/provider'

type OpenAIContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }
type ToolResultContentPart = Extract<LanguageModelV4ToolResultOutput, { type: 'content' }>['value'][number]

export type OpenAIMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | Array<OpenAIContentPart> | null
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }>
  tool_call_id?: string
  result?: string
  is_error?: boolean
}

export type OpenAIToolCall = {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export function convertToProviderMessages(prompt: LanguageModelV4Prompt): Array<OpenAIMessage> {
  const messages: Array<OpenAIMessage> = []

  for (const message of prompt) {
    switch (message.role) {
      case 'system': {
        if (message.content != null) {
          messages.push({
            role: 'system',
            content: message.content,
          })
        }
        break
      }

      case 'user': {
        const content = message.content.flatMap(convertUserContentPart)
        if (content.length === 0) {
          break
        }

        const textOnly = content.every((part) => part.type === 'text')
        messages.push({
          role: 'user',
          content: textOnly ? content.map((part) => part.text).join('') : content,
        })
        break
      }

      case 'assistant': {
        const text: string[] = []
        const toolCalls: Array<OpenAIToolCall> = []

        for (const part of message.content) {
          if (part.type === 'text' || part.type === 'reasoning') {
            text.push(part.text)
          } else if (part.type === 'tool-call') {
            toolCalls.push({
              id: part.toolCallId,
              type: 'function',
              function: {
                name: part.toolName,
                arguments: typeof part.input === 'string' ? part.input : JSON.stringify(part.input),
              },
            })
          }
        }

        if (text.length > 0 || toolCalls.length > 0) {
          messages.push({
            role: 'assistant',
            content: text.length > 0 ? text.join('') : null,
            tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
          })
        }
        break
      }

      case 'tool': {
        for (const part of message.content) {
          if (part.type !== 'tool-result') {
            continue
          }

          messages.push({
            role: 'tool',
            content: convertToolResultOutput(part),
            tool_call_id: part.toolCallId,
          })
        }
        break
      }
    }
  }

  return messages
}

function convertUserContentPart(part: LanguageModelV4TextPart | LanguageModelV4FilePart): OpenAIContentPart[] {
  if (part.type === 'text') {
    return [{ type: 'text', text: part.text }]
  }

  if (part.data.type === 'text') {
    return [{ type: 'text', text: part.data.text }]
  }

  if (!part.mediaType.startsWith('image/')) {
    return []
  }

  if (part.data.type === 'url') {
    return [{ type: 'image_url', image_url: { url: part.data.url.toString() } }]
  }

  if (part.data.type === 'data') {
    return [
      {
        type: 'image_url',
        image_url: {
          url: `data:${part.mediaType};base64,${convertFileDataToBase64(part.data.data)}`,
        },
      },
    ]
  }

  return []
}

function convertFileDataToBase64(data: Uint8Array | string): string {
  return typeof data === 'string' ? data : convertUint8ArrayToBase64(data)
}

function convertToolResultOutput(part: LanguageModelV4ToolResultPart): string {
  switch (part.output.type) {
    case 'text':
    case 'error-text':
      return part.output.value
    case 'json':
    case 'error-json':
      return JSON.stringify(part.output.value)
    case 'execution-denied':
      return part.output.reason ?? 'Execution denied'
    case 'content':
      return part.output.value.map(convertToolResultContentPart).join('')
  }
}

function convertToolResultContentPart(part: ToolResultContentPart): string {
  switch (part.type) {
    case 'text':
      return part.text
    case 'file-data':
      return `data:${part.mediaType};base64,${part.data}`
    case 'file-url':
      return part.url
    case 'file-reference':
    case 'custom':
      return ''
  }
}
