import { useLocation, useNavigate, useSearch } from '@tanstack/react-router'
import { useQueries } from '@tanstack/react-query'
import { AuthPage } from '@/features/auth/auth-page'
import { useAuthDialog } from '@/features/auth/use-auth-dialog'
import { CatalogPage } from '@/features/catalog/catalog-page'
import { catalogSearchSchema } from '@/shared/contracts/marketplace'
import { marketKeys, useFavorites } from '@/shared/api/marketplace-hooks'
import { marketplaceApi } from '@/shared/api/marketplace'
import { NetworkError, CatalogSkeleton } from '@/shared/ui/network-feedback'
import { NftCard } from '@/shared/ui/nft-card'

export function AuthRoute() {
  const dialog = useAuthDialog()
  const pathname = useLocation({ select: (location) => location.pathname })
  const search = useSearch({ strict: false })
  const navigate = useNavigate()
  return (
    <>
      {dialog && (
        <div className="auth-background" aria-hidden="true" inert>
          <CatalogPage
            search={catalogSearchSchema.parse({})}
            onSearchChange={(next) => void navigate({ to: '/', search: next })}
          />
        </div>
      )}
      <AuthPage
        mode={pathname === '/register' ? 'register' : 'login'}
        redirectTo={search.redirect}
      />
    </>
  )
}
export function FavoritesRoute() {
  const favorites = useFavorites()
  const queries = useQueries({
    queries: (favorites.data?.nftIds || []).map((id) => ({
      queryKey: marketKeys.nft(id),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        marketplaceApi.nft(id, signal),
    })),
  })
  const failed = queries.find((query) => query.isError)
  return (
    <>
      <h1>Seus favoritos</h1>
      {favorites.isPending || queries.some((query) => query.isPending) ? (
        <CatalogSkeleton />
      ) : favorites.isError ? (
        <NetworkError
          error={favorites.error}
          retry={() => void favorites.refetch()}
        />
      ) : failed ? (
        <NetworkError
          error={failed.error}
          retry={() => void failed.refetch()}
        />
      ) : favorites.data?.nftIds.length ? (
        <div className="nft-grid account-nft-grid">
          {queries.map(
            (query) =>
              query.data && <NftCard key={query.data.id} nft={query.data} />,
          )}
        </div>
      ) : (
        <p>Você ainda não adicionou NFTs aos favoritos.</p>
      )}
    </>
  )
}
