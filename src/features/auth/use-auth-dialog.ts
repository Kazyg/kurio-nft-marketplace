import { useSyncExternalStore } from 'react'

const media = '(min-width: 768px)'
function subscribe(callback: () => void) {
  const query = window.matchMedia(media)
  query.addEventListener('change', callback)
  return () => query.removeEventListener('change', callback)
}
export function useAuthDialog() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(media).matches,
    () => false,
  )
}
