import { useNavigate, useSearch } from '@tanstack/react-router'
import type { CatalogSearch } from '@/shared/contracts/marketplace'
import { CatalogPage } from '@/features/catalog/catalog-page'

export function CatalogRoute() {
  const search = useSearch({ from: '/' })
  const navigate = useNavigate({ from: '/' })
  function onSearchChange(next: Partial<CatalogSearch>) {
    void navigate({
      search: (previous) => ({ ...previous, ...next, page: next.page ?? 1 }),
      resetScroll: false,
    })
  }
  return <CatalogPage search={search} onSearchChange={onSearchChange} />
}
