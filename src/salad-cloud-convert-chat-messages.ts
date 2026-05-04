import type {
  LanguageModelV4Prompt,
  LanguageModelV4TextPart,
  LanguageModelV4FilePart,
  LanguageModelV4ReasoningPart,
  LanguageModelV4ToolCallPart,
  LanguageModelV4ToolResultPart,
} from '@ai-sdk/provider'

export type OpenAIMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }> | null
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
        const textParts = message.content?.filter(
          (part): part is LanguageModelV4TextPart => part.type === 'text' && part.text != null,
        )

        const fileParts = message.content?.filter((part): part is LanguageModelV4FilePart => part.type === 'file')

        if (textParts != null && textParts.length > 0 && fileParts != null && fileParts.length === 0) {
          messages.push({
            role: 'user',
            content: textParts[0]?.text ?? '',
          })
        } else if (textParts != null && textParts.length > 0 && fileParts != null && fileParts.length > 0) {
          const contentArray: Array<{
            type: 'text' | 'image_url'
            text?: string
            image_url?: { url: string }
          }> = [{ type: 'text', text: textParts[0]?.text ?? '' }]

          for (const filePart of fileParts) {
            contentArray.push({
              type: 'image_url',
              image_url: {
                url: `data:${filePart.mediaType || 'image/png'};base64,data${filePart.data}`,
              },
            })
          }

          messages.push({
            role: 'user',
            content: contentArray,
          })
        } else if (fileParts != null && fileParts.length > 0) {
          const contentArray: Array<{
            type: 'text' | 'image_url'
            text?: string
            image_url?: { url: string }
          }> = []

          for (const filePart of fileParts) {
            contentArray.push({
              type: 'image_url',
              image_url: {
                url: `data:${filePart.mediaType || 'image/png'};base64,data${filePart.data}`,
              },
            })
          }

          messages.push({
            role: 'user',
            content: contentArray,
          })
        }
        break
      }

      case 'assistant': {
        const assistantTextParts = message.content?.filter(
          (part): part is LanguageModelV4TextPart => part.type === 'text' && part.text != null,
        )

        const toolCallParts = message.content?.filter(
          (part): part is LanguageModelV4ToolCallPart => part.type === 'tool-call',
        )

        if (assistantTextParts != null && assistantTextParts.length > 0) {
          messages.push({
            role: 'assistant',
            content: assistantTextParts[0]?.text ?? '',
          })
        }

        if (toolCallParts != null && toolCallParts.length > 0) {
          const toolCalls: Array<OpenAIToolCall> = toolCallParts.map((part) => ({
            id: part.toolCallId,
            type: 'function',
            function: {
              name: part.toolName,
              arguments: JSON.stringify(part.input),
            },
          }))

          messages.push({
            role: 'assistant',
            content: null,
            tool_calls: toolCalls,
          })
        }

        const reasoningPart = message.content?.find(
          (part): part is LanguageModelV4ReasoningPart => part.type === 'reasoning',
        )

        if (reasoningPart != null) {
          messages.push({
            role: 'assistant',
            content: reasoningPart.text,
          })
        }
        break
      }

      case 'tool': {
        const toolResult = message.content?.find(
          (part): part is LanguageModelV4ToolResultPart => part.type === 'tool-result',
        )

        const toolCallId = toolResult?.toolCallId
        const output = toolResult?.output

        messages.push({
          role: 'tool',
          content: output?.type === 'text' ? output.value : '',
          tool_call_id: toolCallId,
        })
        break
      }
    }
  }

  return messages
}
