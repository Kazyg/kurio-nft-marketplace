const key = 'kurio.pendingFavorite'
export function rememberFavorite(nftId: string, returnPath: string) {
  sessionStorage.setItem(
    key,
    JSON.stringify({ nftId, returnPath, expiresAt: Date.now() + 10 * 60_000 }),
  )
}
export function clearAuthIntent() {
  sessionStorage.removeItem(key)
}
export function consumeFavorite(nftId: string, pathname: string) {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return false
    const intent = JSON.parse(raw) as {
      nftId?: string
      returnPath?: string
      expiresAt?: number
    }
    if (!intent.expiresAt || intent.expiresAt < Date.now()) {
      clearAuthIntent()
      return false
    }
    if (intent.nftId !== nftId || intent.returnPath !== pathname) return false
    clearAuthIntent()
    return true
  } catch {
    clearAuthIntent()
    return false
  }
}
