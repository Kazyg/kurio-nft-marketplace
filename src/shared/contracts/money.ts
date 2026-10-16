const SCALE = 10n ** 18n
export function toWei(value: string): bigint {
  if (!/^(0|[1-9]\d*)(\.\d{1,18})?$/.test(value))
    throw new Error('Invalid ETH amount')
  const [whole = '0', fraction = ''] = value.split('.')
  return BigInt(whole) * SCALE + BigInt(fraction.padEnd(18, '0'))
}
export function fromWei(value: bigint): string {
  const fraction = (value % SCALE)
    .toString()
    .padStart(18, '0')
    .replace(/0+$/, '')
  return `${value / SCALE}${fraction ? `.${fraction}` : ''}`
}
export function basisPoints(value: bigint, points: number): bigint {
  return (value * BigInt(points)) / 10000n
}
