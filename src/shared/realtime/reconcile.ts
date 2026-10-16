import type { Cart, Nft, NftList, Order } from '@/shared/contracts/marketplace'

export function latestOrder(previous: Order | undefined, next: Order): Order {
  if (!previous || previous.id !== next.id) return next
  if (previous.version >= next.version) return previous
  if (previous.status !== 'pending' && previous.status !== next.status)
    return previous
  return next
}

export function latestNft(previous: Nft | undefined, next: Nft): Nft {
  return previous?.id === next.id && previous.version >= next.version
    ? previous
    : next
}

export function latestOrderList(previous: Order[] | undefined, next: Order[]) {
  const incoming = next.map((order) =>
    latestOrder(
      previous?.find((item) => item.id === order.id),
      order,
    ),
  )
  return [
    ...incoming,
    ...(previous || []).filter(
      (order) => !next.some((item) => item.id === order.id),
    ),
  ]
}

export function latestCatalog(
  previous: NftList | undefined,
  next: NftList,
): NftList {
  return {
    ...next,
    priceRange:
      previous && previous.priceRange.version > next.priceRange.version
        ? previous.priceRange
        : next.priceRange,
    items: next.items.map((nft) =>
      latestNft(
        previous?.items.find((item) => item.id === nft.id),
        nft,
      ),
    ),
  }
}

export function latestCart(previous: Cart | undefined, next: Cart): Cart {
  if (previous?.id !== next.id) return next
  const base = previous.version > next.version ? previous : next
  return {
    ...base,
    items: base.items.map((item) => ({
      ...item,
      nft: latestNft(
        previous.items.find((old) => old.id === item.id)?.nft,
        item.nft,
      ),
    })),
  }
}
