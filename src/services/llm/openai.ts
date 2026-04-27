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

    // Handle thinking models: separate reasoning_content from content
    const msg = choice?.message
    const content = msg?.content ?? ''

    return {
      content,
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

    // Check Content-Type: if server returned non-streaming JSON, handle it
    const contentType = res.headers.get('content-type') ?? ''
    if (contentType.includes('application/json') && !contentType.includes('text/event-stream')) {
      console.warn('[chatStream] Server returned JSON instead of SSE, falling back to non-streaming parse')
      const data = await res.json()
      const choice = data.choices?.[0]
      const content = choice?.message?.content ?? ''
      onChunk(content)
      return {
        content,
        usage: {
          inputTokens: data.usage?.prompt_tokens ?? 0,
          outputTokens: data.usage?.completion_tokens ?? 0,
        },
      }
    }

    const decoder = new TextDecoder()
    let fullContent = ''
    let inputTokens = 0
    let outputTokens = 0
    let buffer = ''
    let chunkCount = 0
    let parseFailCount = 0
    let contentChunkCount = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const rawChunk = decoder.decode(value, { stream: true })
      buffer += rawChunk
      chunkCount++

      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        if (!trimmed.startsWith('data:')) continue

        const dataStr = trimmed.slice(5).trim()
        if (dataStr === '[DONE]') continue

        try {
          const parsed = JSON.parse(dataStr)
          const delta = parsed.choices?.[0]?.delta

          // Only use actual content, skip reasoning_content (Qwen3/DeepSeek thinking tokens)
          if (delta?.content) {
            fullContent += delta.content
            onChunk(delta.content)
            contentChunkCount++
          }

          if (parsed.usage) {
            inputTokens = parsed.usage.prompt_tokens ?? 0
            outputTokens = parsed.usage.completion_tokens ?? 0
          }
        } catch {
          parseFailCount++
        }
      }
    }

    console.log(`[chatStream] Done. chunks: ${chunkCount}, content: ${contentChunkCount}, fails: ${parseFailCount}, result: ${fullContent.length} chars`)
    if (!fullContent && chunkCount > 0) {
      console.error('[chatStream] No content — model may have only produced reasoning tokens')
    }

    return {
      content: fullContent,
      usage: { inputTokens, outputTokens },
    }
  }
}
