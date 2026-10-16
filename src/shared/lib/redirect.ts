export function safeReturnTo(value: unknown, fallback = '/') {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    [...value].some((character) => character.charCodeAt(0) < 32)
  )
    return fallback
  try {
    const target = new URL(value, window.location.origin)
    if (
      target.origin !== window.location.origin ||
      ['/login', '/register'].includes(target.pathname)
    )
      return fallback
    return `${target.pathname}${target.search}${target.hash}`
  } catch {
    return fallback
  }
}
