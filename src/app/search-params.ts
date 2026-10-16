export function parseSearch(search: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(search))
}

export function stringifySearch(search: Record<string, unknown>) {
  const parameters = new URLSearchParams()
  for (const [key, value] of Object.entries(search)) {
    if (value !== undefined) parameters.set(key, String(value))
  }
  return parameters.size ? `?${parameters.toString()}` : ''
}
