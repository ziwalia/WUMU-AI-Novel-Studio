import { useState } from 'react'
import { useLLMStore } from '@/stores/llmStore'
import { Button } from '@/components/shared/Button'
import { Spinner } from '@/components/shared/Spinner'
import { testConnection } from '@/services/llm'
import type { InterfaceFormat, LLMConfig } from '@/types'

const INTERFACE_FORMATS: { value: InterfaceFormat; label: string }[] = [
  { value: 'OpenAI', label: 'OpenAI' },
  { value: 'Claude', label: 'Claude (Anthropic)' },
  { value: 'DeepSeek', label: 'DeepSeek' },
  { value: 'Gemini', label: 'Gemini (Google)' },
  { value: 'Qwen', label: '通义千问' },
  { value: 'Zhipu', label: '智谱 (GLM)' },
  { value: 'SiliconFlow', label: 'SiliconFlow' },
  { value: 'VolcanoEngine', label: '火山引擎' },
  { value: 'Ollama', label: 'Ollama (本地)' },
  { value: 'LMStudio', label: 'LM Studio (本地)' },
  { value: 'AzureOpenAI', label: 'Azure OpenAI' },
  { value: 'AzureAI', label: 'Azure AI' },
  { value: 'Local', label: '自定义' },
]

const PRESET_URLS: Partial<Record<InterfaceFormat, string>> = {
  OpenAI: 'https://api.openai.com',
  Claude: 'https://api.anthropic.com',
  DeepSeek: 'https://api.deepseek.com',
  Gemini: 'https://generativelanguage.googleapis.com',
  Qwen: 'https://dashscope.aliyuncs.com',
  Zhipu: 'https://open.bigmodel.cn',
  SiliconFlow: 'https://api.siliconflow.cn',
  VolcanoEngine: 'https://ark.cn-beijing.volces.com',
  Ollama: 'http://localhost:11434',
  LMStudio: 'http://localhost:1234',
}

function emptyConfig(): LLMConfig {
  return {
    id: crypto.randomUUID(),
    name: '',
    interfaceFormat: 'OpenAI',
    apiKey: '',
    baseUrl: 'https://api.openai.com',
    modelName: 'gpt-4o',
    temperature: 0.7,
    topP: 1.0,
    maxTokens: 4096,
    timeout: 120000,
  }
}

export function LLMSettingsPanel({ onClose }: { onClose: () => void }) {
  const configs = useLLMStore((s) => s.configs)
  const activeConfigId = useLLMStore((s) => s.activeConfigId)
  const addConfig = useLLMStore((s) => s.addConfig)
  const updateConfig = useLLMStore((s) => s.updateConfig)
  const removeConfig = useLLMStore((s) => s.removeConfig)
  const setActiveConfig = useLLMStore((s) => s.setActiveConfig)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<LLMConfig>(emptyConfig())
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({})
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  const handleNew = () => {
    const newCfg = emptyConfig()
    setEditingId(newCfg.id)
    setEditDraft(newCfg)
  }

  const handleEdit = (config: LLMConfig) => {
    setEditingId(config.id)
    setEditDraft({ ...config })
  }

  const handleSave = () => {
    if (!editDraft.name.trim()) return
    const existing = configs.find((c) => c.id === editingId)
    if (existing) {
      updateConfig(editingId!, editDraft)
    } else {
      addConfig(editDraft)
      setActiveConfig(editDraft.id)
    }
    setEditingId(null)
  }

  const handleDelete = (id: string) => {
    removeConfig(id)
    if (editingId === id) setEditingId(null)
  }

  const handleFormatChange = (format: InterfaceFormat) => {
    const presetUrl = PRESET_URLS[format]
    setEditDraft((prev) => ({
      ...prev,
      interfaceFormat: format,
      baseUrl: presetUrl ?? prev.baseUrl,
    }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-[640px] max-h-[85vh] bg-[var(--color-surface)] rounded-[var(--radius-xl)] shadow-2xl border border-[var(--color-border)] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border-separator)]">
          <div>
            <h2 className="font-headline text-lg font-semibold text-[var(--color-text-primary)]">
              LLM 模型配置
            </h2>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
              添加和管理 AI 模型的 API 连接
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-tertiary)]"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Config list */}
          {configs.length > 0 && (
            <div className="px-6 py-3 space-y-1">
              {configs.map((cfg) => (
                <div
                  key={cfg.id}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] transition-colors ${
                    cfg.id === activeConfigId
                      ? 'bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20'
                      : 'hover:bg-[var(--color-surface-hover)] border border-transparent'
                  }`}
                >
                  <button
                    onClick={() => setActiveConfig(cfg.id)}
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      cfg.id === activeConfigId
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]'
                        : 'border-[var(--color-border)]'
                    }`}
                    aria-label={`激活 ${cfg.name}`}
                  >
                    {cfg.id === activeConfigId && (
                      <span className="block w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                        {cfg.name}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--color-surface-variant)] text-[var(--color-text-tertiary)]">
                        {cfg.interfaceFormat}
                      </span>
                    </div>
                    <span className="text-xs text-[var(--color-text-tertiary)]">
                      {cfg.modelName} · {cfg.baseUrl}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEdit(cfg)}
                      className="p-1 rounded hover:bg-[var(--color-surface-hover)] text-[var(--color-text-tertiary)]"
                    >
                      <span className="material-symbols-outlined text-base">edit</span>
                    </button>
                    <button
                      onClick={() => handleDelete(cfg.id)}
                      className="p-1 rounded hover:bg-red-50 text-[var(--color-text-tertiary)] hover:text-[var(--color-error)]"
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Edit form */}
          {editingId ? (
            <div className="px-6 py-4 border-t border-[var(--color-border-separator)] space-y-3">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                {configs.find((c) => c.id === editingId) ? '编辑配置' : '新建配置'}
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                    配置名称
                  </label>
                  <input
                    type="text"
                    value={editDraft.name}
                    onChange={(e) => setEditDraft((p) => ({ ...p, name: e.target.value }))}
                    placeholder="例如：我的 GPT-4"
                    className="w-full h-9 px-3 text-sm bg-[var(--color-surface-container-lowest)] border border-[var(--color-border)] rounded-[var(--radius-md)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-border-focus)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                    接口格式
                  </label>
                  <select
                    value={editDraft.interfaceFormat}
                    onChange={(e) => handleFormatChange(e.target.value as InterfaceFormat)}
                    className="w-full h-9 px-3 text-sm bg-[var(--color-surface-container-lowest)] border border-[var(--color-border)] rounded-[var(--radius-md)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-border-focus)]"
                  >
                    {INTERFACE_FORMATS.map((f) => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  API Key
                </label>
                <div className="relative">
                  <input
                    type={showApiKeys[editingId] ? 'text' : 'password'}
                    value={editDraft.apiKey}
                    onChange={(e) => setEditDraft((p) => ({ ...p, apiKey: e.target.value }))}
                    placeholder="sk-..."
                    className="w-full h-9 px-3 pr-10 text-sm bg-[var(--color-surface-container-lowest)] border border-[var(--color-border)] rounded-[var(--radius-md)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-border-focus)] font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKeys((p) => ({ ...p, [editingId!]: !p[editingId!] }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
                  >
                    <span className="material-symbols-outlined text-base">
                      {showApiKeys[editingId] ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  Base URL
                </label>
                <input
                  type="text"
                  value={editDraft.baseUrl}
                  onChange={(e) => setEditDraft((p) => ({ ...p, baseUrl: e.target.value }))}
                  placeholder="https://api.openai.com"
                  className="w-full h-9 px-3 text-sm bg-[var(--color-surface-container-lowest)] border border-[var(--color-border)] rounded-[var(--radius-md)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-border-focus)] font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  模型名称
                </label>
                <input
                  type="text"
                  value={editDraft.modelName}
                  onChange={(e) => setEditDraft((p) => ({ ...p, modelName: e.target.value }))}
                  placeholder="gpt-4o / deepseek-chat / qwen-plus"
                  className="w-full h-9 px-3 text-sm bg-[var(--color-surface-container-lowest)] border border-[var(--color-border)] rounded-[var(--radius-md)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-border-focus)] font-mono"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                    Temperature
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={2}
                    step={0.1}
                    value={editDraft.temperature}
                    onChange={(e) => setEditDraft((p) => ({ ...p, temperature: parseFloat(e.target.value) || 0.7 }))}
                    className="w-full h-9 px-3 text-sm bg-[var(--color-surface-container-lowest)] border border-[var(--color-border)] rounded-[var(--radius-md)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-border-focus)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                    Max Tokens
                  </label>
                  <input
                    type="number"
                    min={256}
                    max={128000}
                    step={256}
                    value={editDraft.maxTokens}
                    onChange={(e) => setEditDraft((p) => ({ ...p, maxTokens: parseInt(e.target.value) || 4096 }))}
                    className="w-full h-9 px-3 text-sm bg-[var(--color-surface-container-lowest)] border border-[var(--color-border)] rounded-[var(--radius-md)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-border-focus)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                    Top P
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.05}
                    value={editDraft.topP}
                    onChange={(e) => setEditDraft((p) => ({ ...p, topP: parseFloat(e.target.value) || 1.0 }))}
                    className="w-full h-9 px-3 text-sm bg-[var(--color-surface-container-lowest)] border border-[var(--color-border)] rounded-[var(--radius-md)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-border-focus)]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                {testResult && (
                  <span className={`text-xs mr-auto ${testResult.ok ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}`}>
                    {testResult.message}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={testing || !editDraft.apiKey}
                  onClick={async () => {
                    setTesting(true)
                    setTestResult(null)
                    const result = await testConnection(editDraft)
                    setTestResult(result)
                    setTesting(false)
                  }}
                  icon={testing ? <Spinner size="sm" /> : <span className="material-symbols-outlined text-base">wifi_tethering</span>}
                >
                  {testing ? '测试中...' : '测试连接'}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => { setEditingId(null); setTestResult(null) }}>
                  取消
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSave}
                  disabled={!editDraft.name.trim()}
                >
                  保存
                </Button>
              </div>
            </div>
          ) : (
            <div className="px-6 py-4 border-t border-[var(--color-border-separator)]">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleNew}
                icon={<span className="material-symbols-outlined text-base">add</span>}
              >
                添加模型配置
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
