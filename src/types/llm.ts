export type InterfaceFormat =
  | 'OpenAI'
  | 'Claude'
  | 'DeepSeek'
  | 'Gemini'
  | 'Ollama'
  | 'LMStudio'
  | 'AzureOpenAI'
  | 'AzureAI'
  | 'VolcanoEngine'
  | 'SiliconFlow'
  | 'Qwen'
  | 'Zhipu'
  | 'Local'

export interface LLMConfig {
  id: string
  name: string
  interfaceFormat: InterfaceFormat
  apiKey: string
  baseUrl: string
  modelName: string
  temperature: number
  topP: number
  maxTokens: number
  timeout: number
  proxy?: string
}

export interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMResponse {
  content: string
  usage: { inputTokens: number; outputTokens: number }
}

export type PollingStrategy = 'sequential' | 'random'
