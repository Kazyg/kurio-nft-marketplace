import { apiErrorMessage as errorMessage } from '@/shared/api/marketplace'
import { lazy, Suspense, useId, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { isAxiosError } from 'axios'
import { ArrowLeft, Minus, Plus, Search } from 'lucide-react'
import {
  useAddCartItem,
  useCatalog,
  useNft,
} from '@/shared/api/marketplace-hooks'
import { catalogSearchSchema, type Nft } from '@/shared/contracts/marketplace'
import { Button } from '@/shared/ui/button'
import { FavoriteButton } from '@/shared/ui/favorite-button'
import { NftCard } from '@/shared/ui/nft-card'
import { NetworkError, CatalogSkeleton } from '@/shared/ui/network-feedback'
import { demoReviews } from './demo-reviews'
import { ShareNft } from './share-nft'
import { StarRating } from '@/shared/ui/star-rating'
import { useDesktop } from '@/shared/lib/use-desktop'
import { nftImageProps } from '@/shared/lib/nft-image'

const Dialog = lazy(() =>
  import('@/shared/ui/dialog').then((module) => ({ default: module.Dialog })),
)

function NftDetails({ nft }: { nft: Nft }) {
  const id = useId()
  const desktop = useDesktop()
  const [selectedImage, setSelectedImage] = useState(0)
  const [zoom, setZoom] = useState(false)
  const zoomTrigger = useRef<HTMLButtonElement>(null)
  const [editionId, setEditionId] = useState(
    nft.editions.find((e) => e.available > 0)?.id ?? nft.editions[0]?.id,
  )
  const [quantity, setQuantity] = useState(1)
  const [tab, setTab] = useState('details')
  const [message, setMessage] = useState('')
  const add = useAddCartItem()
  const edition = nft.editions.find((e) => e.id === editionId)
  const related = useCatalog(
    catalogSearchSchema.parse({ collection: nft.collection, pageSize: 6 }),
  )
  const artwork = nft.gallery.length ? nft.gallery : [nft.image]
  const gallery = Array.from(
    { length: Math.max(5, artwork.length) },
    (_, index) => artwork[index % artwork.length]!,
  )
  async function addItem() {
    if (!edition) return
    setMessage('')
    try {
      await add.mutateAsync({ nftId: nft.id, editionId: edition.id, quantity })
      setMessage('NFT adicionado ao carrinho. Continue a compra pelo carrinho.')
    } catch {
      setMessage('')
    }
  }
  return (
    <div className="nft-details-page">
      <div className="breadcrumbs">
        <Link to="/">Início</Link> / Mercado
      </div>
      <div className="product-detail">
        <div className="product-gallery">
          <div className="mobile-product-actions">
            <Link to="/" aria-label="Voltar ao catálogo">
              <ArrowLeft size={20} />
            </Link>
          </div>
          <div className="gallery-thumbnails">
            {gallery.map((image, index) => (
              <button
                aria-label={`Imagem ${index + 1} de ${nft.name}`}
                aria-pressed={index === selectedImage}
                key={`${image}-${index}`}
                onClick={() => setSelectedImage(index)}
              >
                <img
                  {...nftImageProps(image, '80px')}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
              </button>
            ))}
          </div>
          <button
            ref={zoomTrigger}
            className="main-product-image"
            onClick={() => setZoom(true)}
            aria-label={`Ampliar imagem de ${nft.name}`}
          >
            <img
              {...nftImageProps(
                gallery[selectedImage] ?? nft.image,
                '(min-width: 1024px) 520px, 100vw',
              )}
              alt={nft.name}
              fetchPriority="high"
            />
            <Search size={25} />
          </button>
          <div className="gallery-dots">
            {gallery.map((_, index) => (
              <button
                key={index}
                className={selectedImage === index ? 'active' : ''}
                aria-label={`Selecionar imagem ${index + 1}`}
                aria-pressed={selectedImage === index}
                onClick={() => setSelectedImage(index)}
              />
            ))}
          </div>
        </div>
        <section className="product-information">
          <div className="product-title">
            <h1>{nft.name}</h1>
            <div className="product-price-row">
              <strong>{edition?.priceEth ?? nft.priceEth} ETH</strong>
              <span className="rating">
                <StarRating value={nft.rating} />
                {nft.rating} <small>({nft.reviewCount})</small>
                <span className="desktop-copy">
                  {' '}
                  avaliações de colecionadores
                </span>
              </span>
            </div>
          </div>
          <h2>Sobre este NFT:</h2>
          <p>{nft.description}</p>
          <fieldset className="edition-picker">
            <legend>Edição:</legend>
            {nft.editions.map((item) => (
              <label
                key={item.id}
                className={`${editionId === item.id ? 'selected' : ''} ${!item.available ? 'sold-out' : ''}`}
              >
                <input
                  type="radio"
                  name="edition"
                  aria-label={item.label}
                  value={item.id}
                  checked={editionId === item.id}
                  disabled={!item.available}
                  onChange={() => {
                    setEditionId(item.id)
                    setQuantity(1)
                    setMessage('')
                  }}
                />
                {item.label}
              </label>
            ))}
          </fieldset>
          <div className="purchase-controls">
            <div className="quantity-control">
              <span className="quantity-label">Qtd.</span>
              <button
                aria-label="Diminuir quantidade"
                disabled={quantity <= 1}
                onClick={() => setQuantity((q) => q - 1)}
              >
                <Minus size={16} />
              </button>
              <input
                aria-label="Quantidade"
                type="number"
                min={1}
                max={edition?.available ?? 0}
                value={quantity}
                onChange={(e) =>
                  setQuantity(
                    Math.max(
                      1,
                      Math.min(
                        edition?.available ?? 1,
                        Number(e.target.value) || 1,
                      ),
                    ),
                  )
                }
              />
              <button
                aria-label="Aumentar quantidade"
                disabled={quantity >= (edition?.available ?? 0)}
                onClick={() => setQuantity((q) => q + 1)}
              >
                <Plus size={16} />
              </button>
            </div>
            <strong className="purchase-bar-price">
              {edition?.priceEth ?? nft.priceEth} ETH
            </strong>
            <div className="buy-actions">
              <Button
                disabled={add.isPending || !edition?.available}
                onClick={() => void addItem()}
              >
                Comprar
              </Button>
              {desktop ? (
                <FavoriteButton nft={nft} text />
              ) : (
                <Button
                  asChild
                  variant="outline"
                  className="detail-cart-action"
                >
                  <Link to="/cart" aria-label="Ir para o carrinho">
                    <img src="/assets/figma/imgCartIcon.svg" alt="" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
          <dl className="token-info">
            <div>
              <dt>ID do token:</dt>
              <dd>{nft.tokenId}</dd>
            </div>
            <div>
              <dt>Coleção:</dt>
              <dd>{nft.collection}</dd>
            </div>
            <div>
              <dt>Atributos:</dt>
              <dd>{nft.attributes.join(', ')}</dd>
            </div>
          </dl>
          <ShareNft name={nft.name} />
          {message && (
            <p className="purchase-feedback" role="status">
              {message}
            </p>
          )}
          {add.isError && (
            <p role="alert" className="purchase-feedback">
              {errorMessage(add.error)}
            </p>
          )}
        </section>
      </div>
      <section className="product-description">
        <div
          className="description-tabs"
          role="tablist"
          aria-label="Informações do NFT"
          onKeyDown={(event) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key))
              return
            event.preventDefault()
            const next =
              event.key === 'Home'
                ? 'details'
                : event.key === 'End'
                  ? 'reviews'
                  : tab === 'details'
                    ? 'reviews'
                    : 'details'
            setTab(next)
            document.getElementById(`${id}-${next}-tab`)?.focus()
          }}
        >
          <button
            role="tab"
            id={`${id}-details-tab`}
            aria-controls={`${id}-panel`}
            tabIndex={tab === 'details' ? 0 : -1}
            aria-selected={tab === 'details'}
            onClick={() => setTab('details')}
          >
            Detalhes do NFT
          </button>
          <button
            role="tab"
            id={`${id}-reviews-tab`}
            aria-controls={`${id}-panel`}
            tabIndex={tab === 'reviews' ? 0 : -1}
            aria-selected={tab === 'reviews'}
            onClick={() => setTab('reviews')}
          >
            Avaliações de colecionadores ({nft.reviewCount})
          </button>
        </div>
        {tab === 'details' ? (
          <div
            role="tabpanel"
            id={`${id}-panel`}
            aria-labelledby={`${id}-details-tab`}
            tabIndex={0}
          >
            <p>{nft.details}</p>
            <h2>Rede:</h2>
            <p>
              {nft.network}
              {nft.technical?.networkDescription
                ? ` • ${nft.technical.networkDescription}`
                : ''}
            </p>
            <h2>Contrato:</h2>
            <p>
              {nft.technical?.royaltyBasisPoints === undefined
                ? 'Direitos autorais do criador: percentual de royalties não informado.'
                : `Direitos autorais do criador: ${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(nft.technical.royaltyBasisPoints / 100)}% nas vendas secundárias, conforme os metadados do NFT. O repasse depende do suporte do mercado.`}
            </p>
            <h2>Direitos autorais:</h2>
            <p className="nft-contract-reference">
              {nft.technical ? (
                <>
                  <span title={nft.technical.contractAddress}>
                    {nft.technical.contractAddress}
                  </span>{' '}
                  •{' '}
                  {nft.network === 'solana'
                    ? 'Referência de mint'
                    : 'Contrato inteligente'}{' '}
                  {nft.technical.tokenStandard}.
                </>
              ) : (
                'Referência técnica não informada.'
              )}
            </p>
          </div>
        ) : (
          <div
            role="tabpanel"
            id={`${id}-panel`}
            aria-labelledby={`${id}-reviews-tab`}
            tabIndex={0}
          >
            <p>
              Nota dos colecionadores: {nft.rating} de 5, com {nft.reviewCount}{' '}
              avaliações.
            </p>
            <h2>Comentários dos colecionadores</h2>
            <ul className="collector-reviews">
              {demoReviews.map((review, index) => (
                <li key={review.name}>
                  <img
                    {...nftImageProps(
                      gallery[index % gallery.length] ?? nft.image,
                      '48px',
                    )}
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                  <div>
                    <h4>{review.name}</h4>
                    <div className="collector-rating">
                      <StarRating value={review.rating} />
                      <span>{review.rating.toLocaleString('pt-BR')} / 5</span>
                    </div>
                    <p>{review.comment}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
      <section className="related-nfts">
        <h2>Mais desta coleção</h2>
        {related.isPending ? (
          <CatalogSkeleton />
        ) : related.isError ? (
          <NetworkError
            error={related.error}
            retry={() => void related.refetch()}
          />
        ) : (
          <div className="related-grid">
            {related.data.items
              .filter((item) => item.id !== nft.id)
              .slice(0, 5)
              .map((item) => (
                <NftCard nft={item} key={item.id} />
              ))}
          </div>
        )}
      </section>
      {zoom && (
        <Suspense
          fallback={<span role="status">Carregando imagem ampliada…</span>}
        >
          <Dialog
            open={zoom}
            onOpenChange={setZoom}
            title={nft.name}
            className="zoom-dialog"
            onCloseAutoFocus={(event) => {
              event.preventDefault()
              zoomTrigger.current?.focus()
            }}
          >
            <img
              {...nftImageProps(gallery[selectedImage] ?? nft.image, '90vw')}
              alt={nft.name}
            />
          </Dialog>
        </Suspense>
      )}
    </div>
  )
}
export function NftDetailsPage({ nftId }: { nftId: string }) {
  const nft = useNft(nftId)
  if (nft.isPending)
    return (
      <section style={{ minHeight: '100svh' }}>
        <CatalogSkeleton />
      </section>
    )
  if (nft.isError)
    return (
      <NetworkError
        error={nft.error}
        retry={() => void nft.refetch()}
        title={
          isAxiosError(nft.error) && nft.error.response?.status === 404
            ? 'NFT não encontrado'
            : 'Não foi possível carregar o NFT'
        }
      />
    )
  return <NftDetails key={nft.data.id} nft={nft.data} />
}
