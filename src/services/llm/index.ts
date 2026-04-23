import type { LLMConfig, Message, LLMResponse } from '@/types'
import type { LLMProvider } from './base'
import { OpenAIProvider } from './openai'

const provider = new OpenAIProvider()

export function getProvider(): LLMProvider {
  return provider
}

export async function chat(
  config: LLMConfig,
  messages: Message[],
  signal?: AbortSignal
): Promise<LLMResponse> {
  return provider.chat(config, messages, signal)
}

export async function chatStream(
  config: LLMConfig,
  messages: Message[],
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<LLMResponse> {
  return provider.chatStream(config, messages, onChunk, signal)
}

export async function testConnection(config: LLMConfig): Promise<{ ok: boolean; message: string }> {
  return provider.testConnection(config)
}

export type { LLMProvider }
