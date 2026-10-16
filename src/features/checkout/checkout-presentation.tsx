import { useEffect, useState, type ReactNode } from 'react'
import type { Wallet } from '@/shared/contracts/marketplace'
import './checkout-presentation.css'

const asset = (name: string) => `/assets/figma/checkout-${name}.svg`

export interface CheckoutPresentationProps {
  collectorFields: ReactNode
  walletSelection: ReactNode
  networkSelection?: ReactNode
  walletCards?: ReactNode
  providerOptions: ReactNode
  summary: ReactNode
  actions: ReactNode
  review?: ReactNode
  notices?: ReactNode
  backLink?: ReactNode
  connectionStatus?: string
  total?: string
  onChangeWallet?: () => void
}

export function CheckoutPresentation({
  collectorFields,
  walletSelection,
  networkSelection,
  walletCards,
  providerOptions,
  summary,
  actions,
  review,
  notices,
  backLink,
  connectionStatus = 'Carteira desconectada',
  total,
  onChangeWallet,
}: CheckoutPresentationProps) {
  const [mobile, setMobile] = useState(
    () => window.matchMedia('(max-width: 767px)').matches,
  )
  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)')
    const update = () => setMobile(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return (
    <section className="checkout-presentation">
      <nav className="checkout-breadcrumb" aria-label="Localização">
        Início / Mercado / Pagamento
      </nav>
      <header className="checkout-mobile-heading">
        <div className="checkout-back">{backLink}</div>
        <h1>Pagamento com carteira</h1>
      </header>
      {mobile ? (
        <>
          <div className="checkout-payment-status">
            <strong>{connectionStatus}</strong>
            <button
              type="button"
              onClick={() => {
                onChangeWallet?.()
                const details = document.getElementById(
                  'checkout-wallet-details',
                )
                if (details instanceof HTMLDetailsElement) {
                  details.open = true
                  details.scrollIntoView({ block: 'nearest' })
                  requestAnimationFrame(() =>
                    details
                      .querySelector<HTMLSelectElement>('#purchase-wallet')
                      ?.focus(),
                  )
                }
              }}
            >
              Trocar carteira
            </button>
          </div>
          {networkSelection}
          {summary}
          {walletCards}
          {providerOptions}
          {notices}
          {total && (
            <div
              className="checkout-mobile-total"
              data-testid="checkout-mobile-total"
            >
              <strong>Total:</strong>
              <b>{total}</b>
            </div>
          )}
          <div className="checkout-primary-actions">{actions}</div>
          <details
            className="checkout-collector-details"
            id="checkout-wallet-details"
          >
            <summary>Dados do colecionador e NFTs</summary>
            <div className="checkout-collector-panel">
              {collectorFields}
              {walletSelection}
            </div>
          </details>
          {review}
        </>
      ) : (
        <div className="checkout-desktop-grid">
          <div className="checkout-collector-panel">
            {collectorFields}
            {review}
          </div>
          <aside
            className="checkout-payment-panel"
            aria-label="Resumo do checkout"
          >
            {networkSelection}
            {summary}
            {walletCards}
            {walletSelection}
            {providerOptions}
            {notices}
            <div className="checkout-primary-actions">{actions}</div>
          </aside>
        </div>
      )}
    </section>
  )
}

export function CheckoutProviderOptions({
  value,
  onChange,
  onActivate,
  disabled = false,
}: {
  value: Wallet['provider']
  onChange: (provider: Wallet['provider']) => void
  onActivate: (provider: Wallet['provider'], target: HTMLInputElement) => void
  disabled?: boolean
}) {
  return (
    <fieldset className="checkout-providers" disabled={disabled}>
      <legend>Carteira e rede</legend>
      {(
        [
          ['walletconnect', 'WalletConnect', 'W'],
          ['metamask', 'MetaMask', 'M'],
          ['coinbase', 'Coinbase Wallet', null],
        ] as const
      ).map(([provider, label, initial]) => (
        <label className="checkout-provider" key={provider}>
          <input
            type="radio"
            name="checkout-provider"
            value={provider}
            checked={value === provider}
            onChange={() => onChange(provider)}
            onClick={(event) => onActivate(provider, event.currentTarget)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                event.currentTarget.click()
              }
            }}
          />
          <span className="checkout-provider-symbol" aria-hidden="true">
            <img src={asset('provider-circle')} alt="" />
            {initial ? (
              <b>{initial}</b>
            ) : (
              <img
                className="checkout-provider-wallet"
                src={asset('wallet')}
                alt=""
              />
            )}
          </span>
          {provider === 'coinbase' && value === 'coinbase' && (
            <img
              className="checkout-coinbase-desktop"
              src={asset('coinbase-desktop')}
              alt=""
            />
          )}
          <span className="checkout-provider-name">{label}</span>
          {provider === 'walletconnect' && (
            <span className="checkout-provider-badge" aria-hidden="true">
              METAMASK • WALLETCONNECT • COINBASE
            </span>
          )}
          <img
            className="checkout-provider-radio"
            src={asset(value === provider ? 'radio-selected' : 'radio')}
            alt=""
          />
        </label>
      ))}
    </fieldset>
  )
}

export function CheckoutWalletCards({
  wallets,
  selectedId,
  onSelect,
  disabled = false,
}: {
  wallets: Wallet[]
  selectedId: string
  onSelect: (id: string) => void
  disabled?: boolean
}) {
  return (
    <div
      className="checkout-wallet-cards"
      role="group"
      aria-label="Carteiras cadastradas"
    >
      {wallets.map((wallet) => (
        <button
          type="button"
          className="checkout-wallet-card"
          key={wallet.id}
          disabled={disabled}
          aria-pressed={selectedId === wallet.id}
          onClick={() => onSelect(wallet.id)}
        >
          <img
            className="checkout-wallet-card-radio"
            src={asset(selectedId === wallet.id ? 'radio-selected' : 'radio')}
            alt=""
          />
          <span className="checkout-wallet-card-copy">
            <strong>{wallet.label}</strong>
            <span>
              {wallet.ens ||
                `${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}`}
            </span>
            <span>
              Rede{' '}
              {wallet.network === 'ethereum'
                ? 'principal Ethereum'
                : wallet.network === 'polygon'
                  ? 'Polygon'
                  : 'Solana'}
            </span>
          </span>
          <img
            className="checkout-wallet-card-menu"
            src={asset('menu')}
            alt=""
          />
        </button>
      ))}
    </div>
  )
}

export function CheckoutBackIcon() {
  return (
    <span className="checkout-back-icon" aria-hidden="true">
      <img src={asset('back-circle')} alt="" />
      <img src={asset('back-arrow')} alt="" />
    </span>
  )
}
