import { useRef, useState, type FormEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import {
  useCart,
  useProfile,
  useQuote,
  useSession,
  useWallets,
} from '@/shared/api/marketplace-hooks'
import { marketplaceApi, apiErrorMessage } from '@/shared/api/marketplace'
import type {
  Cart,
  FinancialSnapshot,
  Network,
  Quote,
  User,
  Wallet,
} from '@/shared/contracts/marketplace'
import { Button } from '@/shared/ui/button'
import { Dialog } from '@/shared/ui/dialog'
import { NetworkError } from '@/shared/ui/network-feedback'
import {
  FinancialSummary,
  OrderReceipt,
  OrderConfirmationReceipt,
} from '@/features/orders/orders-page'
import { usePurchaseAttempt } from './use-purchase-attempt'
import {
  CheckoutPresentation,
  CheckoutProviderOptions,
  CheckoutWalletCards,
  CheckoutBackIcon,
} from './checkout-presentation'
import './checkout.css'

const collectorSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome completo.').max(80),
  email: z.email('Informe um e-mail válido.'),
  note: z.string().trim().max(1000, 'Use até 1000 caracteres.').optional(),
})
const networkLabels = {
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  solana: 'Solana',
}
const providerLabels = {
  walletconnect: 'WalletConnect',
  metamask: 'MetaMask',
  coinbase: 'Coinbase Wallet',
}
type Collector = z.infer<typeof collectorSchema>
function fingerprint(quote: Quote) {
  return JSON.stringify({
    cartVersion: quote.cartVersion,
    network: quote.network,
    snapshot: quote.snapshot,
  })
}
function changes(before: FinancialSnapshot, after: FinancialSnapshot) {
  const result: string[] = []
  for (const line of after.lines) {
    const old = before.lines.find(
      (item) => item.editionId === line.editionId && item.nftId === line.nftId,
    )
    if (!old) result.push(`${line.name}: edição adicionada.`)
    else {
      if (old.unitPriceEth !== line.unitPriceEth)
        result.push(
          `${line.name}: preço de ${old.unitPriceEth} para ${line.unitPriceEth} ETH.`,
        )
      if (old.quantity !== line.quantity)
        result.push(
          `${line.name}: quantidade de ${old.quantity} para ${line.quantity}.`,
        )
      if (
        old.editionVersion !== line.editionVersion ||
        old.nftVersion !== line.nftVersion
      )
        result.push(
          `${line.name}: disponibilidade ou dados da edição atualizados.`,
        )
    }
  }
  if (
    before.lines.some(
      (line) =>
        !after.lines.some(
          (item) =>
            item.editionId === line.editionId && item.nftId === line.nftId,
        ),
    )
  )
    result.push('Uma edição foi removida da seleção.')
  if (
    before.discountEth !== after.discountEth ||
    before.coupon?.code !== after.coupon?.code
  )
    result.push('O cupom ou desconto mudou.')
  if (before.feeEth !== after.feeEth) result.push('A taxa de rede mudou.')
  return result.length
    ? result
    : ['A seleção foi atualizada. Revise novamente.']
}

export function CheckoutPage() {
  const session = useSession()
  const profile = useProfile()
  const cart = useCart()
  const wallets = useWallets()
  if (profile.isPending || cart.isPending || wallets.isPending)
    return (
      <section className="purchase-page" aria-busy="true">
        <p role="status">Preparando compra…</p>
      </section>
    )
  const failure = profile.error || cart.error || wallets.error
  if (failure)
    return (
      <section className="purchase-page">
        <NetworkError
          title="Não foi possível preparar a compra"
          error={failure}
          retry={() => {
            void profile.refetch()
            void cart.refetch()
            void wallets.refetch()
          }}
        />
      </section>
    )
  if (!session.data?.user || !profile.data || !cart.data || !wallets.data)
    return null
  return (
    <CheckoutContent
      key={session.data.user.id}
      user={profile.data}
      cart={cart.data}
      wallets={wallets.data}
    />
  )
}

function CheckoutContent({
  user,
  cart,
  wallets,
}: {
  user: User
  cart: Cart
  wallets: Wallet[]
}) {
  const purchase = usePurchaseAttempt(user.id)
  const couponKey = `kurio:coupon:${cart.id}`
  const [coupon, setCoupon] = useState(
    () => sessionStorage.getItem(couponKey) || '',
  )
  const [draft, setDraft] = useState(coupon)
  const cartNetworks = [...new Set(cart.items.map((item) => item.nft.network))]
  const [chosenNetwork, setChosenNetwork] = useState<Network | undefined>()
  const network =
    cartNetworks.length === 1
      ? cartNetworks[0]
      : chosenNetwork && cartNetworks.includes(chosenNetwork)
        ? chosenNetwork
        : undefined
  const quote = useQuote(coupon || undefined, network)
  const [reviewed, setReviewed] = useState<Quote | null>(null)
  const [accepted, setAccepted] = useState(false)
  const [changeNotice, setChangeNotice] = useState<string[]>([])
  const [walletId, setWalletId] = useState(
    () =>
      wallets.find((wallet) => wallet.network === network && wallet.isDefault)
        ?.id ||
      wallets.find((wallet) => wallet.network === network)?.id ||
      '',
  )
  const [connectionState, setConnectionState] = useState<{
    key: string
    status: 'disconnected' | 'connected' | 'declined'
  }>({ key: '', status: 'disconnected' })
  const [connecting, setConnecting] = useState(false)
  const [otherWallet, setOtherWallet] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const [error, setError] = useState('')
  const [dismissedReceipt, setDismissedReceipt] = useState('')
  const compatibleWallets = wallets.filter((item) => item.network === network)
  const wallet =
    compatibleWallets.find((item) => item.id === walletId) ||
    compatibleWallets.find((item) => item.isDefault) ||
    compatibleWallets[0]
  const [chosenProvider, setChosenProvider] = useState<
    Wallet['provider'] | undefined
  >()
  const provider = chosenProvider || wallet?.provider || 'walletconnect'
  const connectionKey = `${wallet?.id}:${wallet?.version}:${network}:${provider}`
  const connection =
    connectionState.key === connectionKey
      ? connectionState.status
      : 'disconnected'
  function setConnection(status: 'disconnected' | 'connected' | 'declined') {
    setConnectionState({ key: connectionKey, status })
  }
  const [reviewedConnection, setReviewedConnection] = useState('')
  const lock = useRef(false)
  const connectTrigger = useRef<HTMLElement>(null)
  const {
    register,
    handleSubmit,
    getValues,
    setError: setFieldError,
    formState: { errors },
  } = useForm<Collector>({
    defaultValues: { name: user.name, email: user.email, note: '' },
  })
  const compatible =
    !!wallet &&
    wallet.network === network &&
    cart.items.some((item) => item.nft.network === network)
  const busy =
    preparing || purchase.phase === 'sending' || purchase.phase === 'recovering'
  const order = purchase.order.data
  const displayed =
    (quote.data?.network === network ? quote.data : null) ||
    (reviewed?.network === network ? reviewed : null)
  const reviewStale =
    !!reviewed &&
    (!quote.data ||
      fingerprint(reviewed) !== fingerprint(quote.data) ||
      quote.isError ||
      quote.isFetching ||
      quote.data.network !== network ||
      reviewedConnection !== connectionKey)
  function applyCoupon(event: FormEvent) {
    event.preventDefault()
    const value = draft.trim().toUpperCase()
    sessionStorage.setItem(couponKey, value)
    setCoupon(value)
    setReviewed(null)
    setAccepted(false)
    if (value === coupon) void quote.refetch()
  }
  async function refreshReview() {
    setPreparing(true)
    setError('')
    setAccepted(false)
    try {
      const next = await quote.refetch({ throwOnError: true })
      if (next.data) {
        setChangeNotice(
          reviewed && fingerprint(reviewed) !== fingerprint(next.data)
            ? changes(reviewed.snapshot, next.data.snapshot)
            : [],
        )
        setReviewed(next.data)
        setReviewedConnection(connectionKey)
      }
    } catch (cause) {
      setReviewed(null)
      setError(apiErrorMessage(cause))
    } finally {
      setPreparing(false)
    }
  }
  const review = async (event: FormEvent<HTMLFormElement>) => {
    await handleSubmit(async (values) => {
      const valid = collectorSchema.safeParse(values)
      if (!valid.success) {
        valid.error.issues.forEach((issue) =>
          setFieldError(issue.path[0] as keyof Collector, {
            message: issue.message,
          }),
        )
        return
      }
      if (!compatible || connection !== 'connected') {
        setError(
          'Selecione uma carteira e conecte uma rede compatível com todos os NFTs.',
        )
        return
      }
      await finalize()
    })(event)
  }
  async function finalize() {
    if (
      lock.current ||
      !displayed ||
      (changeNotice.length > 0 && !accepted) ||
      reviewStale ||
      !compatible ||
      connection !== 'connected'
    )
      return
    lock.current = true
    setPreparing(true)
    setError('')
    try {
      const fresh = await marketplaceApi.quote({
        couponCode: coupon || undefined,
        network,
      })
      const baseline = reviewed || displayed
      if (fingerprint(baseline) !== fingerprint(fresh)) {
        setChangeNotice(changes(baseline.snapshot, fresh.snapshot))
        setReviewed(fresh)
        setReviewedConnection(connectionKey)
        setAccepted(false)
        await quote.refetch()
        return
      }
      const values = collectorSchema.parse(getValues())
      await purchase.send({
        quoteId: fresh.id,
        walletId: wallet!.id,
        network,
        collector: values,
      })
    } catch (cause) {
      setError(apiErrorMessage(cause))
      setReviewed(null)
      setAccepted(false)
      void quote.refetch()
    } finally {
      setPreparing(false)
      lock.current = false
    }
  }
  if (purchase.checkingEntry)
    return (
      <section className="purchase-page" aria-busy="true">
        <p role="status">Preparando nova compra…</p>
      </section>
    )
  if (order)
    return (
      <section className="purchase-page">
        <div className="purchase-heading">
          <span>COMPRA SIMULADA</span>
          <h1>Acompanhe seu pedido</h1>
        </div>
        <div className="purchase-panel">
          <OrderReceipt order={order} />
          <div className="purchase-actions">
            <Button asChild>
              <Link
                id="purchase-order-details"
                to="/orders/$orderId"
                params={{ orderId: order.id }}
              >
                Ver detalhes do pedido
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/">Continuar explorando</Link>
            </Button>
            {order.status !== 'pending' && (
              <Button variant="outline" onClick={purchase.clear}>
                Iniciar nova compra
              </Button>
            )}
          </div>
        </div>
        <Dialog
          open={dismissedReceipt !== order.id && order.status === 'confirmed'}
          onOpenChange={(open) => {
            if (!open) setDismissedReceipt(order.id)
          }}
          title="Compra confirmada"
          className="purchase-confirmation"
          overlayClassName="confirmation-overlay"
          closeIcon={<img src="/assets/figma/confirmation-close.svg" alt="" />}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            document.getElementById('purchase-order-details')?.focus()
          }}
        >
          <OrderConfirmationReceipt order={order} />
          <Button onClick={() => setDismissedReceipt(order.id)}>
            Fechar recibo
          </Button>
        </Dialog>
      </section>
    )
  if (purchase.attempt?.orderId)
    return (
      <section className="purchase-page">
        {purchase.order.isError ? (
          <NetworkError
            title="Não foi possível recuperar o pedido"
            error={purchase.order.error}
            retry={() => void purchase.order.refetch()}
          />
        ) : (
          <p role="status">Recuperando pedido…</p>
        )}
      </section>
    )
  if (purchase.attempt)
    return (
      <section className="purchase-page">
        <div className="purchase-panel">
          <h1>
            {busy
              ? purchase.phase === 'sending'
                ? 'Enviando pedido…'
                : 'Recuperando pedido…'
              : 'Resultado desconhecido'}
          </h1>
          <p role="status">
            {busy
              ? 'Aguarde o processamento.'
              : 'Não foi possível determinar o resultado. A tentativa está salva; recuperar ou repetir usa a mesma chave e os mesmos dados.'}
          </p>
          {purchase.error && (
            <p role="alert">Erro de conexão: {purchase.error}</p>
          )}
          <Button disabled={busy} onClick={() => void purchase.send()}>
            Recuperar ou repetir mesma tentativa
          </Button>
          <p>
            Não inicie outra compra enquanto o resultado desta tentativa for
            desconhecido.
          </p>
        </div>
      </section>
    )
  if (!cart.items.length)
    return (
      <section className="purchase-page">
        <div className="purchase-panel">
          <h1>Seu carrinho está vazio</h1>
          <Button asChild>
            <Link to="/">Explorar NFTs</Link>
          </Button>
        </div>
      </section>
    )
  function resetReview() {
    setReviewed(null)
    setAccepted(false)
    setChangeNotice([])
    setError('')
  }
  function selectWallet(id: string) {
    setWalletId(id)
    setChosenProvider(undefined)
    setConnection('disconnected')
    resetReview()
  }
  const networkSelection = (
    <label>
      Rede
      <select
        aria-label="Rede"
        value={network || ''}
        disabled={busy}
        onChange={(event) => {
          const next = event.target.value as Network
          setChosenNetwork(next)
          setWalletId('')
          setChosenProvider(undefined)
          setConnection('disconnected')
          resetReview()
        }}
      >
        {!network && <option value="">Selecione a rede da compra</option>}
        {cartNetworks.map((value) => (
          <option key={value} value={value}>
            {networkLabels[value]}
          </option>
        ))}
      </select>
    </label>
  )
  const walletSelection = (
    <div className="checkout-wallet-selection">
      <label htmlFor="purchase-wallet">Carteira cadastrada</label>
      <select
        id="purchase-wallet"
        value={wallet?.id || ''}
        disabled={busy || !compatibleWallets.length}
        onChange={(event) => selectWallet(event.target.value)}
      >
        {!wallet && <option value="">Nenhuma carteira compatível</option>}
        {compatibleWallets.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label} · {item.network}
          </option>
        ))}
      </select>
    </div>
  )
  const collectorFields = (
    <form
      id="purchase-collector"
      onSubmit={review}
      noValidate
      className="checkout-collector-form"
    >
      <h2>Perfil do colecionador</h2>
      <div className="checkout-fields">
        <label htmlFor="purchase-name">
          Nome de exibição
          <input
            id="purchase-name"
            disabled={busy}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? 'purchase-name-error' : undefined}
            {...register('name', { onChange: resetReview })}
          />
          {errors.name && (
            <span id="purchase-name-error" role="alert">
              {errors.name.message}
            </span>
          )}
        </label>
        <label>
          Nome de usuário
          <input value={user.username} readOnly />
        </label>
        {networkSelection}
        <label>
          Nome do perfil
          <input value={wallet?.profileName || user.name} readOnly />
        </label>
        <label>
          Endereço da carteira
          <input
            value={wallet?.address || ''}
            readOnly
            placeholder="Selecione uma carteira compatível"
          />
        </label>
        <label className="checkout-secondary-field">
          <span className="sr-only">ENS ou carteira secundária</span>
          <input
            value={wallet?.secondaryAddress || ''}
            readOnly
            placeholder="ENS ou carteira secundária (opcional)"
          />
        </label>
        <label>
          Tipo de carteira
          <input
            value={providerLabels[wallet?.provider || 'walletconnect']}
            readOnly
          />
        </label>
        <label>
          Código de indicação
          <input value={wallet?.referralCode || ''} readOnly />
        </label>
        <label htmlFor="purchase-email">
          E-mail
          <input
            id="purchase-email"
            type="email"
            disabled={busy}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'purchase-email-error' : undefined}
            {...register('email', { onChange: resetReview })}
          />
          {errors.email && (
            <span id="purchase-email-error" role="alert">
              {errors.email.message}
            </span>
          )}
        </label>
        <label>
          Nome ENS
          <div className="checkout-ens">
            <span aria-hidden="true">
              .eth
              <img src="/assets/figma/account-arrow.svg" alt="" />
            </span>
            <input value={wallet?.ens || user.ens || ''} readOnly />
          </div>
        </label>
      </div>
      <label className="checkout-other-wallet">
        <input
          type="checkbox"
          role="switch"
          checked={otherWallet}
          disabled={busy}
          onChange={(event) => setOtherWallet(event.target.checked)}
        />
        Usar outra carteira?
      </label>
      <div className="checkout-alternate-wallet" hidden={!otherWallet}>
        {walletSelection}
        {wallet && <Link to="/wallets">Gerenciar carteiras</Link>}
      </div>
      <label className="checkout-note">
        Observação do colecionador (opcional)
        <textarea
          rows={5}
          disabled={busy}
          {...register('note', { onChange: resetReview })}
          aria-invalid={!!errors.note}
          aria-describedby={errors.note ? 'purchase-note-error' : undefined}
        />
        {errors.note && (
          <span id="purchase-note-error" role="alert">
            {errors.note.message}
          </span>
        )}
      </label>
      <small className="checkout-data-note">
        Dados da conta e da carteira são editados em Perfil e Carteiras. A
        observação será salva apenas neste pedido.
      </small>
    </form>
  )
  const summary = (
    <div className="checkout-order-summary" aria-label="Resumo do checkout">
      <h2>Seus NFTs</h2>
      <form onSubmit={applyCoupon}>
        <label htmlFor="purchase-coupon">Código promocional</label>
        <div className="purchase-coupon">
          <input
            id="purchase-coupon"
            disabled={busy}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <Button
            type="submit"
            variant="outline"
            disabled={!draft.trim() || busy || quote.isFetching}
          >
            Aplicar cupom
          </Button>
        </div>
      </form>
      {coupon && (
        <div className="purchase-actions">
          <span>{coupon}</span>
          <button
            disabled={busy || quote.isFetching}
            onClick={() => {
              sessionStorage.removeItem(couponKey)
              setCoupon('')
              setDraft('')
              setReviewed(null)
              setAccepted(false)
            }}
          >
            Remover cupom
          </button>
        </div>
      )}
      <p role="status" className="checkout-quote-status">
        {quote.isFetching
          ? 'Atualizando cotação…'
          : quote.isError
            ? 'Cotação indisponível'
            : 'Cotação atualizada'}
      </p>
      {quote.isError && <p role="alert">{apiErrorMessage(quote.error)}</p>}
      {displayed && <FinancialSummary snapshot={displayed.snapshot} />}
    </div>
  )
  return (
    <section className="purchase-page checkout-page">
      <h1 className="sr-only checkout-route-title">Finalizar compra</h1>
      <CheckoutPresentation
        onChangeWallet={() => setOtherWallet(true)}
        collectorFields={collectorFields}
        walletSelection={null}
        walletCards={
          <CheckoutWalletCards
            wallets={compatibleWallets}
            selectedId={wallet?.id || ''}
            onSelect={selectWallet}
            disabled={busy}
          />
        }
        providerOptions={
          <CheckoutProviderOptions
            value={provider}
            onActivate={(value, target) => {
              setChosenProvider(value)
              connectTrigger.current = target
              setConnecting(true)
            }}
            onChange={(value) => {
              setChosenProvider(value)
              setConnection('disconnected')
              resetReview()
            }}
            disabled={busy || !compatible}
          />
        }
        summary={summary}
        actions={
          <>
            <p className="checkout-connection-state" role="status">
              {connection === 'connected'
                ? 'Carteira conectada'
                : connection === 'declined'
                  ? 'Conexão recusada'
                  : 'Carteira desconectada'}
            </p>
            <div className="purchase-actions">
              {connection === 'connected' ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setConnection('disconnected')
                    resetReview()
                  }}
                >
                  Desconectar carteira
                </Button>
              ) : null}
            </div>
            <Button
              id="purchase-review"
              type="submit"
              form="purchase-collector"
              disabled={
                busy ||
                quote.isFetching ||
                quote.isError ||
                reviewStale ||
                (changeNotice.length > 0 && !accepted) ||
                !compatible ||
                connection !== 'connected'
              }
            >
              Confirmar compra
            </Button>
          </>
        }
        connectionStatus={
          connection === 'connected' ? 'Carteira conectada' : 'Suas carteiras'
        }
        total={
          displayed?.snapshot.totalEth
            ? `${displayed.snapshot.totalEth} ETH`
            : undefined
        }
        notices={
          <>
            {cartNetworks.length > 1 && (
              <p role="status">
                Seu carrinho contém{' '}
                {cartNetworks.map((value) => networkLabels[value]).join(', ')}.
                Escolha uma rede para comprar seus itens. Os NFTs das outras
                redes permanecerão no carrinho.
              </p>
            )}
            {!wallet && (
              <p role="alert">
                {network
                  ? `Cadastre uma carteira ${networkLabels[network]} para continuar.`
                  : 'Selecione primeiro a rede que deseja comprar.'}{' '}
                <Link to="/wallets">Gerenciar carteiras</Link>
              </p>
            )}
            {(error || purchase.error) && (
              <p role="alert" className="purchase-alert">
                {error || purchase.error}
              </p>
            )}
          </>
        }
        review={
          (reviewStale || changeNotice.length > 0) && (
            <div className="checkout-quote-notice" role="alert">
              <strong>As condições mudaram</strong>
              {changeNotice.length > 0 && (
                <ul>
                  {changeNotice.map((notice, index) => (
                    <li key={index}>{notice}</li>
                  ))}
                </ul>
              )}
              {reviewStale ? (
                <>
                  <p>
                    Os preços ou a disponibilidade podem ter mudado. Atualize os
                    valores antes de confirmar.
                  </p>
                  <Button
                    variant="outline"
                    disabled={busy || quote.isFetching}
                    onClick={() => void refreshReview()}
                  >
                    Atualizar valores
                  </Button>
                </>
              ) : !accepted ? (
                <>
                  <p>
                    Confira os novos valores no resumo da compra e aceite para
                    continuar.
                  </p>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => setAccepted(true)}
                  >
                    Aceitar valores atualizados
                  </Button>
                </>
              ) : (
                <p>
                  Valores atualizados aceitos. Confirme a compra para enviar o
                  pedido.
                </p>
              )}
            </div>
          )
        }
        backLink={
          <Link to="/cart" aria-label="Voltar ao carrinho">
            <CheckoutBackIcon />
          </Link>
        }
      />
      <Dialog
        open={connecting}
        onOpenChange={setConnecting}
        title="Conectar carteira"
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          ;(
            connectTrigger.current || document.getElementById('purchase-review')
          )?.focus()
        }}
      >
        <p>
          Conectar {wallet?.label} via {providerLabels[provider]}?
        </p>
        <div className="purchase-actions">
          <Button
            onClick={() => {
              setConnection('connected')
              setReviewed(quote.data || null)
              setReviewedConnection(connectionKey)
              setAccepted(true)
              setChangeNotice([])
              setConnecting(false)
            }}
          >
            Conectar carteira
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setConnection('declined')
              setConnecting(false)
            }}
          >
            Recusar conexão
          </Button>
        </div>
      </Dialog>
    </section>
  )
}
