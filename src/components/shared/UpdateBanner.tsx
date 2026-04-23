import { useEffect, useState } from 'react'
import { checkForUpdate, type UpdateCheckResult } from '@/services/updateService'

export function UpdateBanner() {
  const [update, setUpdate] = useState<UpdateCheckResult | null>(null)

  useEffect(() => {
    checkForUpdate().then((result) => {
      if (result.hasUpdate) setUpdate(result)
    })
  }, [])

  if (!update?.hasUpdate) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-[var(--color-primary)] text-white text-center text-sm py-1.5 px-4 flex items-center justify-center gap-3">
      <span>
        发现新版本 v{update.latestVersion}，建议刷新页面或下载桌面版获得最佳体验
      </span>
      <button
        onClick={() => window.location.reload()}
        className="px-3 py-0.5 bg-white/20 hover:bg-white/30 rounded-[var(--radius-sm)] text-xs font-medium transition-colors"
      >
        刷新页面
      </button>
      <a
        href={update.downloadUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="px-3 py-0.5 bg-white/20 hover:bg-white/30 rounded-[var(--radius-sm)] text-xs font-medium transition-colors"
      >
        下载桌面版
      </a>
      <button
        onClick={() => setUpdate(null)}
        className="ml-2 hover:bg-white/20 rounded-[var(--radius-sm)] p-0.5 transition-colors"
      >
        <span className="material-symbols-outlined text-base">close</span>
      </button>
    </div>
  )
}
