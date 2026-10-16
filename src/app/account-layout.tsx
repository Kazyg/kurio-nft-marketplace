import { Suspense } from 'react'
import { Outlet, useLocation } from '@tanstack/react-router'
import { AccountSidebar } from '@/shared/ui/account-sidebar'

export function AccountLayout() {
  const path = useLocation({ select: (location) => location.pathname })
  const active = path as '/profile' | '/wallets' | '/favorites' | '/orders'
  const variant =
    active === '/profile'
      ? 'account-page'
      : active === '/wallets'
        ? 'wallets-page'
        : `account-collection ${active === '/orders' ? 'account-purchases' : ''}`
  return (
    <section className={`account-shell ${variant}`}>
      <AccountSidebar active={active} />
      <div className="account-main">
        <Suspense
          fallback={
            <div className="account-loading" role="status" aria-busy="true">
              Carregando dados da conta…
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </div>
    </section>
  )
}
