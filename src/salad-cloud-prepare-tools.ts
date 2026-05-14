import type { SharedV4Warning, LanguageModelV4ToolChoice } from '@ai-sdk/provider'

export type OpenAITool = {
  type: 'function'
  function: {
    name: string
    description?: string
    parameters: Record<string, unknown>
  }
}

export interface PrepareToolsResult {
  tools: Array<OpenAITool>
  tool_choice: OpenAIToolChoice | undefined
  warnings: Array<SharedV4Warning>
}

export type OpenAIToolChoice =
  | 'auto'
  | 'none'
  | 'required'
  | { type: 'function'; function: { name: string } }

export function prepareTools(
  tools: Array<{
    type: 'function'
    name: string
    description?: string
    parameters?: Record<string, unknown>
  }>,
  toolChoice: LanguageModelV4ToolChoice | undefined,
): PrepareToolsResult {
  const warnings: Array<SharedV4Warning> = []

  const openaiTools = tools.map(
    (tool): OpenAITool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters ?? {},
      },
    }),
  )

  let tool_choice: OpenAIToolChoice | undefined
  if (toolChoice == null) {
    tool_choice = undefined
  } else if (toolChoice.type === 'auto' || toolChoice.type === 'none' || toolChoice.type === 'required') {
    tool_choice = toolChoice.type
  } else if (toolChoice.type === 'tool' && toolChoice.toolName) {
    tool_choice = { type: 'function', function: { name: toolChoice.toolName } }
  } else {
    tool_choice = undefined
  }

  return {
    tools: openaiTools,
    tool_choice,
    warnings,
  }
}
