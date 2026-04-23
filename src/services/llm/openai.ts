import type { LLMConfig, Message, LLMResponse } from '@/types'
import type { LLMProvider } from './base'
import { buildHeaders, buildPayload, resolveEndpoint } from './base'

export class OpenAIProvider implements LLMProvider {
  async testConnection(config: LLMConfig): Promise<{ ok: boolean; message: string }> {
    try {
      const url = resolveEndpoint(config)
      const payload = buildPayload(config, [
        { role: 'user', content: 'Hi' },
      ], false)
      payload.max_tokens = 5

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), config.timeout || 15000)

      const res = await fetch(url, {
        method: 'POST',
        headers: buildHeaders(config),
        body: JSON.stringify(payload),
        signal: controller.signal,
      })

      clearTimeout(timeout)

      if (res.ok) {
        return { ok: true, message: '连接成功' }
      }
      const text = await res.text().catch(() => '')
      return { ok: false, message: `HTTP ${res.status}: ${text.slice(0, 100)}` }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { ok: false, message: '连接超时' }
      }
      return { ok: false, message: err instanceof Error ? err.message : '连接失败' }
    }
  }

  async chat(config: LLMConfig, messages: Message[], signal?: AbortSignal): Promise<LLMResponse> {
    const url = resolveEndpoint(config)
    const payload = buildPayload(config, messages, false)

    const res = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(config),
      body: JSON.stringify(payload),
      signal,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`LLM 请求失败 (${res.status}): ${text}`)
    }

    const data = await res.json()
    const choice = data.choices?.[0]

    return {
      content: choice?.message?.content ?? '',
      usage: {
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
      },
    }
  }

  async chatStream(
    config: LLMConfig,
    messages: Message[],
    onChunk: (text: string) => void,
    signal?: AbortSignal
  ): Promise<LLMResponse> {
    const url = resolveEndpoint(config)
    const payload = buildPayload(config, messages, true)

    const res = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(config),
      body: JSON.stringify(payload),
      signal,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`LLM 流式请求失败 (${res.status}): ${text}`)
    }

    const reader = res.body?.getReader()
    if (!reader) throw new Error('无法获取响应流')

    const decoder = new TextDecoder()
    let fullContent = ''
    let inputTokens = 0
    let outputTokens = 0
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data:')) continue

        const dataStr = trimmed.slice(5).trim()
        if (dataStr === '[DONE]') continue

        try {
          const parsed = JSON.parse(dataStr)
          const delta = parsed.choices?.[0]?.delta?.content
          if (delta) {
            fullContent += delta
            onChunk(delta)
          }
          if (parsed.usage) {
            inputTokens = parsed.usage.prompt_tokens ?? 0
            outputTokens = parsed.usage.completion_tokens ?? 0
          }
        } catch {
          // skip malformed chunks
        }
      }
    }

    return {
      content: fullContent,
      usage: { inputTokens, outputTokens },
    }
  }
}
