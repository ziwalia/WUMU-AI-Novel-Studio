import type { LLMConfig, Message, LLMResponse } from '@/types'

export interface LLMProvider {
  testConnection(config: LLMConfig): Promise<{ ok: boolean; message: string }>
  chat(config: LLMConfig, messages: Message[], signal?: AbortSignal): Promise<LLMResponse>
  chatStream(
    config: LLMConfig,
    messages: Message[],
    onChunk: (text: string) => void,
    signal?: AbortSignal
  ): Promise<LLMResponse>
}

export function buildHeaders(config: LLMConfig): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.apiKey}`,
  }
}

export function buildPayload(config: LLMConfig, messages: Message[], stream: boolean) {
  return {
    model: config.modelName,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    temperature: config.temperature,
    top_p: config.topP,
    max_tokens: config.maxTokens,
    stream,
  }
}

export function resolveEndpoint(config: LLMConfig): string {
  let base = config.baseUrl.replace(/\/+$/, '')
  if (!base.includes('/v1') && !base.includes('/v1beta')) {
    base += '/v1'
  }
  return `${base}/chat/completions`
}
