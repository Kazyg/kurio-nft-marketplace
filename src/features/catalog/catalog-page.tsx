import { lazy, Suspense, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  Search,
  SlidersHorizontal,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useCatalog, useCatalogContent } from '@/shared/api/marketplace-hooks'
import type { CatalogSearch, NftList } from '@/shared/contracts/marketplace'
import { Button } from '@/shared/ui/button'
import { NftCard } from '@/shared/ui/nft-card'
import { NetworkError, CatalogSkeleton } from '@/shared/ui/network-feedback'
import { useDesktop } from '@/shared/lib/use-desktop'
import { nftImageProps } from '@/shared/lib/nft-image'

const Dialog = lazy(() =>
  import('@/shared/ui/dialog').then((module) => ({ default: module.Dialog })),
)
const PriceFilter = lazy(() =>
  import('./price-filter').then((module) => ({ default: module.PriceFilter })),
)

function Filters({
  search,
  data,
  change,
}: {
  search: CatalogSearch
  data?: NftList
  change: (next: Partial<CatalogSearch>) => void
}) {
  const [resetPrice, setResetPrice] = useState(0)
  return (
    <div className="filters">
      <section>
        <h2>Coleções</h2>
        <button
          className={!search.category ? 'active' : ''}
          onClick={() => change({ category: undefined, page: 1 })}
        >
          Todas as coleções
        </button>
        {data?.facets.categories.map((facet) => (
          <button
            key={facet.value}
            className={search.category === facet.value ? 'active' : ''}
            aria-pressed={search.category === facet.value}
            onClick={() =>
              change({
                category:
                  search.category === facet.value ? undefined : facet.value,
                page: 1,
              })
            }
          >
            {facet.label}
            <b>({facet.count})</b>
          </button>
        ))}
      </section>
      <section>
        <h2>Faixa de preço</h2>
        {data && (
          <Suspense
            fallback={
              <div
                role="status"
                aria-label="Carregando faixa de preço"
                style={{ minHeight: 170 }}
              />
            }
          >
            <PriceFilter
              search={search}
              ceiling={data.priceRange.maxEth}
              change={change}
              reset={resetPrice}
            />
          </Suspense>
        )}
      </section>
      <section>
        <h2>Rede</h2>
        {data?.facets.networks.map((facet) => (
          <button
            key={facet.value}
            className={search.network === facet.value ? 'active' : ''}
            aria-pressed={search.network === facet.value}
            onClick={() =>
              change({
                network:
                  search.network === facet.value ? undefined : facet.value,
                page: 1,
              })
            }
          >
            {facet.label}
            <span>({facet.count})</span>
          </button>
        ))}
      </section>
      <button
        className="clear-filters"
        onClick={() => {
          setResetPrice((value) => value + 1)
          change({
            category: undefined,
            network: undefined,
            minPrice: undefined,
            maxPrice: undefined,
            q: '',
            page: 1,
          })
        }}
      >
        Limpar filtros
      </button>
    </div>
  )
}
export function CatalogPage({
  search,
  onSearchChange,
}: {
  search: CatalogSearch
  onSearchChange: (next: Partial<CatalogSearch>) => void
}) {
  const catalog = useCatalog(search)
  const content = useCatalogContent()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const filtersTrigger = useRef<HTMLButtonElement>(null)
  const desktop = useDesktop()
  const pages = Math.ceil((catalog.data?.total ?? 0) / search.pageSize)
  const body = content.data
  return (
    <>
      {!desktop && (
        <div className="catalog-search">
          <label>
            <Search size={22} />
            <input
              aria-label="Buscar NFTs"
              placeholder="Explorar coleções"
              value={search.q}
              onChange={(e) => onSearchChange({ q: e.target.value, page: 1 })}
            />
          </label>
          <button
            ref={filtersTrigger}
            aria-label="Abrir filtros"
            onClick={() => setFiltersOpen(true)}
          >
            <SlidersHorizontal size={23} />
          </button>
        </div>
      )}
      {content.isPending && !body && (
        <section
          className="hero hero-placeholder"
          aria-label="Carregando destaques"
          aria-busy="true"
        >
          <div className="hero-placeholder-copy shimmer" />
          <div className="hero-art shimmer" />
        </section>
      )}
      {body && (
        <section className="hero">
          <div className="hero-copy">
            <p className="hero-eyebrow">{body.hero.eyebrow}</p>
            <h1>
              <span className="desktop-copy">{body.hero.title}</span>
              <span className="mobile-copy">{body.hero.mobileTitle}</span>
            </h1>
            <p className="hero-description desktop-copy">
              {body.hero.description}
            </p>
            <p className="hero-description mobile-copy">
              {body.hero.mobileDescription}
            </p>
            <a href="#catalog" className="hero-explore">
              EXPLORAR <ArrowRight size={20} />
            </a>
            <div className="hero-dots" aria-hidden="true">
              ●●●
            </div>
          </div>
          <Link
            to="/nfts/$nftId"
            params={{ nftId: body.hero.nftId }}
            className="hero-art"
          >
            <img
              {...nftImageProps(
                body.hero.image,
                '(max-width: 375px) 120px, (max-width: 767px) 138px, (max-width: 1279px) 35vw, 408px',
              )}
              fetchPriority="high"
              alt="NFT em destaque"
              width={450}
              height={450}
            />
            <img
              className="hero-secondary"
              {...nftImageProps(body.hero.secondaryImage, '58px')}
              alt=""
              loading="lazy"
            />
          </Link>
        </section>
      )}
      {content.isError && (
        <NetworkError
          error={content.error}
          retry={() => void content.refetch()}
          title="Não foi possível carregar os destaques"
        />
      )}
      <section className="catalog-section" id="catalog">
        {desktop && (
          <aside className="catalog-sidebar">
            <Filters
              search={search}
              data={catalog.data}
              change={onSearchChange}
            />
            {body && (
              <Link
                to="/nfts/$nftId"
                params={{ nftId: body.featured.nftId }}
                className="featured-banner"
              >
                <h2>{body.featured.title}</h2>
                <h3>{body.featured.subtitle}</h3>
                <img
                  {...nftImageProps(body.featured.image, '310px')}
                  alt="NFT em destaque"
                  loading="lazy"
                />
              </Link>
            )}
          </aside>
        )}
        <div className="catalog-results" aria-busy={catalog.isFetching}>
          <div className="catalog-toolbar">
            <div className="catalog-tabs" role="tablist" aria-label="Catálogo">
              {(
                [
                  ['all', 'Todos os NFTs'],
                  ['new', 'Novos lançamentos'],
                  ['trending', 'Em alta'],
                ] as const
              ).map(([value, label]) => (
                <button
                  role="tab"
                  aria-selected={search.tab === value}
                  key={value}
                  onClick={() => onSearchChange({ tab: value, page: 1 })}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="sort-label">
              Ordenar por:
              <select
                aria-label="Ordenar por"
                value={search.sort}
                onChange={(e) =>
                  onSearchChange({
                    sort: e.target.value as CatalogSearch['sort'],
                    page: 1,
                  })
                }
              >
                <option value="recent">Listados recentemente</option>
                <option value="price-asc">Menor preço</option>
                <option value="price-desc">Maior preço</option>
                <option value="popular">Mais populares</option>
              </select>
            </label>
          </div>
          <p className="catalog-update" aria-live="polite">
            {catalog.isFetching && catalog.data ? 'Atualizando NFTs…' : ''}
          </p>
          {catalog.isPending && !catalog.data ? (
            <CatalogSkeleton />
          ) : catalog.isError ? (
            <NetworkError
              error={catalog.error}
              retry={() => void catalog.refetch()}
            />
          ) : !catalog.data.items.length ? (
            <div className="network-state" data-testid="catalog-empty">
              <h2>Nenhum NFT encontrado</h2>
              <p>Tente outros termos ou remova os filtros.</p>
              <Button
                onClick={() =>
                  onSearchChange({
                    q: '',
                    category: undefined,
                    network: undefined,
                    minPrice: undefined,
                    maxPrice: undefined,
                    page: 1,
                  })
                }
              >
                Limpar filtros
              </Button>
            </div>
          ) : (
            <>
              <div className="nft-grid" data-testid="catalog-grid">
                {catalog.data.items.map((nft, index) => (
                  <NftCard nft={nft} key={nft.id} priority={index === 0} />
                ))}
              </div>
              <nav className="pagination" aria-label="Paginação">
                <button
                  disabled={search.page <= 1 || catalog.isPlaceholderData}
                  aria-label="Página anterior"
                  onClick={() => onSearchChange({ page: search.page - 1 })}
                >
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: pages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    aria-label={`Página ${page}`}
                    aria-current={page === search.page ? 'page' : undefined}
                    disabled={catalog.isPlaceholderData}
                    onClick={() => onSearchChange({ page })}
                  >
                    {page}
                  </button>
                ))}
                <button
                  disabled={search.page >= pages || catalog.isPlaceholderData}
                  aria-label="Próxima página"
                  onClick={() => onSearchChange({ page: search.page + 1 })}
                >
                  <ChevronRight size={16} />
                </button>
              </nav>
            </>
          )}
        </div>
      </section>
      {body && (
        <>
          <section className="promotions">
            {body.promotions.map((promo) => (
              <article key={promo.id}>
                <img
                  {...nftImageProps(
                    promo.image,
                    '(min-width: 1024px) 280px, 45vw',
                  )}
                  alt=""
                  loading="lazy"
                />
                <div>
                  <h2>{promo.title}</h2>
                  <p>{promo.description}</p>
                  <Button
                    onClick={() => {
                      onSearchChange({ category: promo.category, page: 1 })
                      document
                        .getElementById('catalog')
                        ?.scrollIntoView({ behavior: 'smooth' })
                    }}
                  >
                    Explorar <ArrowRight size={16} />
                  </Button>
                </div>
              </article>
            ))}
          </section>
          <section className="journal">
            <h2>Diário da Cunhagem</h2>
            <p>
              Histórias, guias e insights para colecionadores sobre o universo
              da propriedade digital.
            </p>
            <div className="article-grid">
              {body.articles.map((article) => (
                <article key={article.id}>
                  <img
                    {...nftImageProps(
                      article.image,
                      '(min-width: 1024px) 380px, 45vw',
                    )}
                    alt=""
                    loading="lazy"
                  />
                  <div>
                    <small>
                      {new Date(article.date).toLocaleDateString('pt-BR', {
                        timeZone: 'UTC',
                        day: 'numeric',
                        month: 'long',
                      })}{' '}
                      | Leitura de {article.readingMinutes} min
                    </small>
                    <h3>{article.title}</h3>
                    <p>{article.description}</p>
                    <span className="muted">Em breve</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
      {filtersOpen && (
        <Suspense fallback={<span role="status">Carregando filtros…</span>}>
          <Dialog
            title="Filtrar NFTs"
            open={filtersOpen}
            onOpenChange={setFiltersOpen}
            className="filter-dialog"
            onCloseAutoFocus={(event) => {
              event.preventDefault()
              filtersTrigger.current?.focus()
            }}
          >
            <label className="sort-label filter-sort">
              Ordenar por:
              <select
                aria-label="Ordenar por"
                value={search.sort}
                onChange={(event) =>
                  onSearchChange({
                    sort: event.target.value as CatalogSearch['sort'],
                    page: 1,
                  })
                }
              >
                <option value="recent">Listados recentemente</option>
                <option value="price-asc">Menor preço</option>
                <option value="price-desc">Maior preço</option>
                <option value="popular">Mais populares</option>
              </select>
            </label>
            <Filters
              search={search}
              data={catalog.data}
              change={onSearchChange}
            />
            <Button onClick={() => setFiltersOpen(false)}>
              Ver resultados
            </Button>
          </Dialog>
        </Suspense>
      )}
    </>
  )
}
