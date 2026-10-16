import { Button } from './button'
import { apiErrorMessage as errorMessage } from '@/shared/api/marketplace'
export function NetworkError({
  error,
  retry,
  title = 'Não foi possível carregar os NFTs',
}: {
  error: unknown
  retry: () => void
  title?: string
}) {
  return (
    <div className="network-state" data-testid="catalog-error" role="alert">
      <h2>{title}</h2>
      <p>{errorMessage(error)}</p>
      <Button onClick={retry}>Tentar novamente</Button>
    </div>
  )
}
export function CatalogSkeleton() {
  return (
    <div
      className="nft-grid"
      role="status"
      aria-label="Carregando NFTs"
      aria-busy="true"
    >
      <span className="sr-only">Carregando NFTs…</span>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} data-testid="catalog-skeleton" className="nft-skeleton">
          <div className="skeleton-art shimmer" />
          <div className="skeleton-line shimmer" />
          <div className="skeleton-line short shimmer" />
        </div>
      ))}
    </div>
  )
}
