import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useLogout } from '@/shared/api/marketplace-hooks'
import { apiErrorMessage } from '@/shared/api/marketplace'
import './account-sidebar.css'

const items = [
  { label: 'Dados do perfil', icon: 'user', to: '/profile' },
  { label: 'Carteiras', icon: 'location', to: '/wallets' },
  { label: 'Atividade', icon: 'shopping', to: '/orders' },
  { label: 'Lista de interesse', icon: 'heart', to: '/favorites' },
  { label: 'Ofertas', icon: 'activity' },
  { label: 'Arquivos baixados', icon: 'download' },
  { label: 'Suporte', icon: 'support' },
] as const

export function AccountSidebar({
  active,
}: {
  active: '/profile' | '/wallets' | '/favorites' | '/orders'
}) {
  const logout = useLogout()
  const [notice, setNotice] = useState('')
  return (
    <aside className="account-sidebar">
      <h2>Meu perfil</h2>
      <nav aria-label="Conta do colecionador">
        {items.map((item) => {
          const content = (
            <>
              <span
                className={`account-nav-icon account-nav-icon-${item.icon}`}
                aria-hidden="true"
              >
                <img src={`/assets/figma/account-${item.icon}.svg`} alt="" />
              </span>
              <span>{item.label}</span>
            </>
          )
          return 'to' in item ? (
            <Link
              key={item.label}
              to={item.to}
              aria-current={active === item.to ? 'page' : undefined}
            >
              {content}
            </Link>
          ) : (
            <button
              key={item.label}
              type="button"
              onClick={() =>
                setNotice(`${item.label} ainda não está disponível.`)
              }
            >
              {content}
            </button>
          )
        })}
        <button
          className="account-signout"
          type="button"
          disabled={logout.isPending}
          onClick={() => logout.mutate()}
        >
          <span
            className="account-nav-icon account-nav-icon-logout"
            aria-hidden="true"
          >
            <img src="/assets/figma/account-logout.svg" alt="" />
          </span>
          <span>Sair</span>
        </button>
      </nav>
      {notice && <p role="status">{notice}</p>}
      {logout.isError && <p role="alert">{apiErrorMessage(logout.error)}</p>}
    </aside>
  )
}
