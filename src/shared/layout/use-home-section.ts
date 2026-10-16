import { useEffect, useState } from 'react'

export function useHomeSection(enabled: boolean, location: string) {
  const [catalogVisible, setCatalogVisible] = useState(false)
  useEffect(() => {
    if (!enabled) return
    const update = () => {
      const catalog = document.getElementById('catalog')
      setCatalogVisible(!!catalog && catalog.getBoundingClientRect().top <= 120)
    }
    const frame = requestAnimationFrame(update)
    const observer = new ResizeObserver(update)
    observer.observe(document.documentElement)
    window.addEventListener('scroll', update, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('scroll', update)
    }
  }, [enabled, location])
  return enabled && catalogVisible
}
