import { useRef, useState, useSyncExternalStore } from 'react'
import { useCatalog } from '@/shared/api/marketplace-hooks'
import { catalogSearchSchema } from '@/shared/contracts/marketplace'
import { NftCard } from '@/shared/ui/nft-card'
import { CatalogSkeleton, NetworkError } from '@/shared/ui/network-feedback'

function subscribe(callback: () => void) {
  const queries = [
    window.matchMedia('(min-width: 1200px)'),
    window.matchMedia('(min-width: 700px)'),
  ]
  queries.forEach((query) => query.addEventListener('change', callback))
  return () =>
    queries.forEach((query) => query.removeEventListener('change', callback))
}

export function CartRelated() {
  const catalog = useCatalog(catalogSearchSchema.parse({ pageSize: 15 }))
  const rail = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const perPage = useSyncExternalStore(
    subscribe,
    () => (window.innerWidth >= 1200 ? 5 : window.innerWidth >= 700 ? 3 : 2),
    () => 5,
  )
  const pages = Math.ceil((catalog.data?.items.length ?? 0) / perPage)
  function goTo(index: number) {
    const element = rail.current
    const card = element?.children[index * perPage] as HTMLElement | undefined
    if (element && card)
      element.scrollTo({
        left:
          card.offsetLeft -
          (element.firstElementChild as HTMLElement).offsetLeft,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
      })
  }
  return (
    <section
      className="cart-related"
      aria-labelledby="cart-related-title"
      aria-roledescription="carrossel"
    >
      <h2 id="cart-related-title">Colecionadores também viram</h2>
      {catalog.isPending ? (
        <CatalogSkeleton />
      ) : catalog.isError ? (
        <NetworkError
          error={catalog.error}
          retry={() => void catalog.refetch()}
        />
      ) : (
        <>
          <div
            className="cart-related-rail"
            ref={rail}
            tabIndex={0}
            aria-label="NFTs relacionados"
            onScroll={(event) => {
              const element = event.currentTarget
              const first = element.firstElementChild as HTMLElement | null
              if (first)
                setActive(
                  Math.min(
                    pages - 1,
                    Math.round(
                      element.scrollLeft /
                        ((first.offsetWidth +
                          parseFloat(getComputedStyle(element).columnGap)) *
                          perPage),
                    ),
                  ),
                )
            }}
          >
            {catalog.data.items.map((nft) => (
              <NftCard key={nft.id} nft={nft} compact />
            ))}
          </div>
          <div
            className="cart-related-dots"
            aria-label="Páginas dos relacionados"
          >
            {Array.from({ length: pages }, (_, index) => (
              <button
                key={index}
                type="button"
                aria-label={`Ver página ${index + 1} dos relacionados`}
                aria-pressed={active === index}
                onClick={() => goTo(index)}
              >
                <span />
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
