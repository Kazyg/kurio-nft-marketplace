const artworkNames = new Set([
  'cosmic-bloom',
  'emerald-ape',
  'golden-beat',
  'golden-signal',
  'ivory-baron',
  'neon-vessel',
  'sage-nomad',
  'violet-nomad',
])

export function nftImageProps(src: string, sizes: string) {
  const name = /^\/assets\/nfts\/([\w-]+)\.png$/.exec(src)?.[1]
  if (!name || !artworkNames.has(name)) return { src }
  const base = `/assets/nfts/responsive/${name}`
  return {
    src: `${base}-1254.webp`,
    srcSet: [160, 320, 640, 960, 1254]
      .map((width) => `${base}-${width}.webp ${width}w`)
      .join(', '),
    sizes,
    width: 1254,
    height: 1254,
  }
}
