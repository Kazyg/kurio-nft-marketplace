import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type CSSProperties,
} from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowRight, ShoppingBag } from 'lucide-react'
import {
  useCart,
  useQuote,
  useRemoveCartItem,
  useUpdateCartItem,
} from '@/shared/api/marketplace-hooks'
import { apiErrorMessage } from '@/shared/api/marketplace'
import type { Cart } from '@/shared/contracts/marketplace'
import { Button } from '@/shared/ui/button'
import { NetworkError } from '@/shared/ui/network-feedback'
import { useDesktop } from '@/shared/lib/use-desktop'
import { nftImageProps } from '@/shared/lib/nft-image'
import { CartRelated } from './cart-related'
import './cart.css'

export function CartPage() {
  const cart = useCart()
  const desktop = useDesktop()
  return (
    <section className="cart-page" aria-label="Carrinho">
      <nav className="cart-breadcrumb" aria-label="Caminho da página">
        <Link to="/">Início</Link> /{' '}
        <Link to="/" hash="catalog">
          Mercado
        </Link>{' '}
        / <span aria-current="page">Carrinho</span>
      </nav>
      <div className="cart-mobile-heading">
        <Link to="/" aria-label="Voltar ao mercado">
          <img
            className="cart-back-circle"
            src="/assets/figma/cart-back-circle.svg"
            alt=""
          />
          <img
            className="cart-back-arrow"
            src="/assets/figma/cart-back-arrow.svg"
            alt=""
          />
        </Link>
        <h1>Carrinho de NFTs</h1>
      </div>
      {cart.isPending ? (
        <div
          aria-label="Carregando carrinho"
          role="status"
          aria-busy="true"
          className="cart-loading"
        >
          <span className="sr-only">Carregando carrinho…</span>
          {[0, 1, 2].map((i) => (
            <div key={i} className="shimmer" />
          ))}
        </div>
      ) : cart.isError ? (
        <NetworkError
          title="Não foi possível carregar o carrinho"
          error={cart.error}
          retry={() => void cart.refetch()}
        />
      ) : cart.data.items.length ? (
        <CartContent key={cart.data.id} cart={cart.data} />
      ) : (
        <section className="cart-empty">
          <ShoppingBag size={44} aria-hidden="true" />
          <h2>Seu carrinho está vazio</h2>
          <p>Explore o catálogo e encontre sua próxima coleção.</p>
          <Button asChild>
            <Link to="/">
              Explorar NFTs <ArrowRight size={18} />
            </Link>
          </Button>
        </section>
      )}
      {cart.isSuccess && desktop && <CartRelated />}
    </section>
  )
}

function CartContent({ cart }: { cart: Cart }) {
  const summary = useRef<HTMLElement>(null)
  const [summaryHeight, setSummaryHeight] = useState(420)
  useEffect(() => {
    const element = summary.current
    if (!element) return
    const observer = new ResizeObserver(() =>
      setSummaryHeight(element.getBoundingClientRect().height),
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const storageKey = `kurio:coupon:${cart.id}`
  const [coupon, setCoupon] = useState(
    () => sessionStorage.getItem(storageKey) || '',
  )
  const [draft, setDraft] = useState(coupon)
  const [now, setNow] = useState(() => Date.now())
  const quote = useQuote(coupon || undefined)
  const update = useUpdateCartItem()
  const remove = useRemoveCartItem()
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const busy = update.isPending || remove.isPending
  const current =
    !!quote.data &&
    quote.data.cartId === cart.id &&
    quote.data.cartVersion === cart.version &&
    Date.parse(quote.data.expiresAt) > now &&
    !quote.isFetching &&
    !quote.isPlaceholderData &&
    !quote.isError &&
    !busy
  const matchingQuote =
    quote.data?.cartId === cart.id && quote.data.cartVersion === cart.version
  const blockedReason = busy
    ? 'Aguarde a atualização dos itens para continuar.'
    : quote.isFetching
      ? 'Aguarde a atualização da cotação para continuar.'
      : quote.isError
        ? 'Não foi possível validar a cotação. Confira o cupom ou tente atualizar a cotação.'
        : quote.data && Date.parse(quote.data.expiresAt) <= now
          ? 'Sua cotação expirou. Clique em Atualizar cotação para continuar ao pagamento.'
          : 'Atualize a cotação para confirmar os valores e continuar ao pagamento.'
  function applyCoupon(event: FormEvent) {
    event.preventDefault()
    const next = draft.trim().toUpperCase()
    sessionStorage.setItem(storageKey, next)
    setCoupon(next)
    if (next === coupon) void quote.refetch()
  }
  function clearCoupon() {
    sessionStorage.removeItem(storageKey)
    setCoupon('')
    setDraft('')
  }
  return (
    <div
      className="cart-layout"
      style={{ '--cart-summary-height': `${summaryHeight}px` } as CSSProperties}
    >
      <section aria-label="Itens do carrinho" className="cart-items">
        <div className="cart-table-heading">
          <span>NFTs</span>
          <span>Preço</span>
          <span>Edições</span>
          <span>Total</span>
          <span />
        </div>
        {cart.items.map((item) => {
          const edition = item.nft.editions.find(
            (entry) => entry.id === item.editionId,
          )
          const available = edition?.available ?? 0
          const line = matchingQuote
            ? quote.data?.snapshot.lines.find(
                (entry) =>
                  entry.nftId === item.nftId &&
                  entry.editionId === item.editionId,
              )
            : undefined
          return (
            <article className="cart-row" key={item.id} data-testid="cart-item">
              <div className="cart-art">
                <Link to="/nfts/$nftId" params={{ nftId: item.nftId }}>
                  <img
                    {...nftImageProps(
                      item.nft.image,
                      '(min-width: 1024px) 96px, 80px',
                    )}
                    alt={item.nft.name}
                    decoding="async"
                  />
                </Link>
                <div>
                  <Link to="/nfts/$nftId" params={{ nftId: item.nftId }}>
                    {item.nft.name}
                  </Link>
                  <p className="cart-token">ID do token: {item.nft.tokenId}</p>
                  <p className="cart-edition">Edição: {edition?.label}</p>
                  <span className="cart-stock">
                    <span className="sr-only">
                      {available ? `${available} disponíveis` : 'Esgotado'}
                    </span>
                    {item.quantity > available && (
                      <strong role="alert"> Ajuste a quantidade</strong>
                    )}
                  </span>
                </div>
              </div>
              <span
                className="cart-unit-price"
                aria-label={`Preço de ${item.nft.name}`}
              >
                {line ? `${line.unitPriceEth} ETH` : 'Atualizando…'}
              </span>
              <div className="cart-quantity">
                <button
                  aria-label={`Diminuir quantidade de ${item.nft.name}`}
                  disabled={busy || item.quantity <= 1}
                  onClick={() =>
                    update.mutate({ id: item.id, quantity: item.quantity - 1 })
                  }
                >
                  <picture>
                    <source
                      media="(max-width: 1023px)"
                      srcSet="/assets/figma/cart-mobile-minus.svg"
                    />
                    <img src="/assets/figma/cart-minus.svg" alt="" />
                  </picture>
                </button>
                <output aria-label={`Quantidade de ${item.nft.name}`}>
                  {item.quantity}
                </output>
                <button
                  aria-label={`Aumentar quantidade de ${item.nft.name}`}
                  disabled={busy || item.quantity >= available}
                  onClick={() =>
                    update.mutate({ id: item.id, quantity: item.quantity + 1 })
                  }
                >
                  <img
                    className="cart-desktop-plus"
                    src="/assets/figma/cart-plus.svg"
                    alt=""
                  />
                  <span className="cart-mobile-plus" aria-hidden="true">
                    +
                  </span>
                </button>
              </div>
              <strong
                className="cart-line-total"
                aria-label={`Total de ${item.nft.name}`}
              >
                {line ? `${line.totalEth} ETH` : 'Atualizando…'}
              </strong>
              <button
                className="cart-remove"
                aria-label={`Remover ${item.nft.name}`}
                disabled={busy}
                onClick={() => remove.mutate(item.id)}
              >
                <img src="/assets/figma/cart-delete.svg" alt="" />
              </button>
            </article>
          )
        })}
        {update.isError && (
          <div role="alert" className="cart-alert">
            <p>{apiErrorMessage(update.error)}</p>
            <Button
              variant="outline"
              onClick={() =>
                update.variables && update.mutate(update.variables)
              }
            >
              Tentar alterar novamente
            </Button>
          </div>
        )}
        {remove.isError && (
          <div role="alert" className="cart-alert">
            <p>{apiErrorMessage(remove.error)}</p>
            <Button
              variant="outline"
              onClick={() =>
                remove.variables && remove.mutate(remove.variables)
              }
            >
              Tentar remover novamente
            </Button>
          </div>
        )}
      </section>
      <aside
        ref={summary}
        className="cart-summary"
        aria-label="Resumo da carteira"
      >
        <h2>Resumo da carteira</h2>
        <form onSubmit={applyCoupon}>
          <label htmlFor="cart-coupon">Código promocional</label>
          <div className="cart-coupon-field">
            <input
              id="cart-coupon"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={80}
              autoComplete="off"
              placeholder="Digite o código promocional..."
            />
            <Button
              type="submit"
              variant="outline"
              disabled={!draft.trim() || quote.isFetching || busy}
            >
              Aplicar
            </Button>
          </div>
        </form>
        {coupon && (
          <div className="cart-coupon-active">
            <span>{coupon}</span>
            <button onClick={clearCoupon} disabled={quote.isFetching}>
              Remover cupom
            </button>
          </div>
        )}
        <p data-testid="quote-status" role="status">
          {quote.isFetching
            ? 'Atualizando cotação…'
            : current
              ? 'Cotação atualizada'
              : 'Cotação indisponível ou desatualizada'}
        </p>
        {quote.isError && (
          <p role="alert" className="cart-alert">
            {apiErrorMessage(quote.error)}
          </p>
        )}
        {quote.data && (
          <div
            className={
              !current
                ? 'cart-financial cart-financial-stale'
                : 'cart-financial'
            }
            aria-label="Valores da cotação"
          >
            <dl>
              <div>
                <dt>Subtotal</dt>
                <dd>{quote.data.snapshot.subtotalEth} ETH</dd>
              </div>
              <div>
                <dt>Desconto do lançamento</dt>
                <dd>(−) {quote.data.snapshot.discountEth} ETH</dd>
              </div>
              <div>
                <dt>Taxa de rede</dt>
                <dd>
                  {quote.data.snapshot.feeEth} ETH<small>Taxa estimada</small>
                </dd>
              </div>
              <div className="cart-total">
                <dt>Total</dt>
                <dd data-testid="quote-total">
                  {quote.data.snapshot.totalEth} ETH
                </dd>
              </div>
            </dl>
          </div>
        )}
        {!current && (
          <div className="cart-blocked">
            <p className="cart-alert" role="status">
              {blockedReason}
            </p>
            <Button
              variant="outline"
              disabled={quote.isFetching || busy}
              onClick={() => void quote.refetch()}
            >
              Atualizar cotação
            </Button>
          </div>
        )}
        {current ? (
          <Button asChild className="cart-checkout">
            <Link to="/checkout">Conectar e finalizar</Link>
          </Button>
        ) : (
          <Button className="cart-checkout" disabled>
            Conectar e finalizar
          </Button>
        )}
        <Link to="/" className="cart-continue">
          Continuar explorando
        </Link>
      </aside>
    </div>
  )
}
