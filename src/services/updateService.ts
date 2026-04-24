const GITHUB_REPO = 'ziwalia/WUMU-AI-Novel-Studio'
const CHECK_INTERVAL = 30 * 60 * 1000 // 30分钟检查一次

let lastCheckTime = 0
let cachedLatestVersion: string | null = null

function isTauriApp(): boolean {
  return !!(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
}

async function fetchLatestVersion(): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      { headers: { Accept: 'application/vnd.github.v3+json' } }
    )
    if (!res.ok) {
      // 仓库无 Release 或仓库不存在时返回 null，不输出错误
      res.body?.cancel()
      return null
    }
    const data = await res.json()
    const tag = data.tag_name as string
    return tag.replace(/^v/, '')
  } catch {
    return null
  }
}

function compareVersions(current: string, latest: string): boolean {
  const c = current.split('.').map(Number)
  const l = latest.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((l[i] ?? 0) > (c[i] ?? 0)) return true
    if ((l[i] ?? 0) < (c[i] ?? 0)) return false
  }
  return false
}

export interface UpdateCheckResult {
  hasUpdate: boolean
  currentVersion: string
  latestVersion: string | null
  downloadUrl: string
}

export async function checkForUpdate(): Promise<UpdateCheckResult> {
  const currentVersion = __APP_VERSION__

  // 桌面版由 Tauri 更新器处理，这里只管网页版
  if (isTauriApp()) {
    return { hasUpdate: false, currentVersion, latestVersion: null, downloadUrl: '' }
  }

  const now = Date.now()
  if (now - lastCheckTime < CHECK_INTERVAL && cachedLatestVersion !== null) {
    return {
      hasUpdate: compareVersions(currentVersion, cachedLatestVersion),
      currentVersion,
      latestVersion: cachedLatestVersion,
      downloadUrl: `https://github.com/${GITHUB_REPO}/releases/latest`,
    }
  }

  lastCheckTime = now
  const latestVersion = await fetchLatestVersion()
  cachedLatestVersion = latestVersion

  return {
    hasUpdate: latestVersion ? compareVersions(currentVersion, latestVersion) : false,
    currentVersion,
    latestVersion,
    downloadUrl: `https://github.com/${GITHUB_REPO}/releases/latest`,
  }
}
