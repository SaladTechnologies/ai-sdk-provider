# SaladCloud AI SDK Provider

Vercel AI SDK provider for the SaladCloud AI Gateway.

```bash
npm install @saladtechnologies-oss/ai-sdk-provider ai@beta zod
```

## Setup

```bash
export SALAD_CLOUD_API_KEY="your-api-key"
```

The provider uses `https://ai.salad.cloud/v1` by default. Override it with `SALAD_CLOUD_BASE_URL` or the `baseURL` option.

## Usage

```ts
import { generateText } from 'ai'
import { saladCloud } from '@saladtechnologies-oss/ai-sdk-provider'

const result = await generateText({
  model: saladCloud('qwen3.6-35b-a3b'),
  prompt: 'Say hello in one sentence.',
})

console.log(result.text)
```

## Streaming

```ts
import { streamText } from 'ai'
import { saladCloud } from '@saladtechnologies-oss/ai-sdk-provider'

const result = streamText({
  model: saladCloud('qwen3.6-35b-a3b'),
  prompt: 'Say hello in one sentence.',
})

for await (const text of result.textStream) {
  process.stdout.write(text)
}
```

## Custom Configuration

```ts
import { createSaladCloud } from '@saladtechnologies-oss/ai-sdk-provider'

const saladCloud = createSaladCloud({
  apiKey: process.env.SALAD_CLOUD_API_KEY,
  baseURL: process.env.SALAD_CLOUD_BASE_URL,
})
```

## Models

Current SaladCloud AI Gateway models:

- `qwen3.6-35b-a3b`
- `qwen3.6-27b`
- `qwen3.5-9b`
- `gemma-4-26b-a4b-instruct`

## Provider Options

Use `providerOptions.salad-cloud` for SaladCloud-specific options.

For Qwen reasoning models, `reasoning: 'none'` sends `chat_template_kwargs: { enable_thinking: false }` to disable thinking. Omitting `reasoning`, or using `low`, `medium`, or `high`, leaves SaladCloud/vLLM thinking behavior enabled by default.

```ts
const result = await generateText({
  model: saladCloud('qwen3.6-35b-a3b'),
  prompt: 'Think briefly, then answer.',
  reasoning: 'low',
  providerOptions: {
    'salad-cloud': {
      topK: 40,
      reasoningEffort: 'medium',
    },
  },
})
```

## Vision

For SaladCloud models that support vision, image URL and inline image data parts from the Vercel AI SDK are sent as OpenAI-compatible `image_url` content.

```ts
import { generateText } from 'ai'
import { saladCloud } from '@saladtechnologies-oss/ai-sdk-provider'

const result = await generateText({
  model: saladCloud('qwen3.6-35b-a3b'),
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Describe this image.' },
        { type: 'file', mediaType: 'image/png', data: { type: 'url', url: new URL('https://example.com/image.png') } },
      ],
    },
  ],
})
```
