import { useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { Home, Heart, ShoppingCart, UserRound, ScanLine } from 'lucide-react'
import { useCart, useSession, useLogout } from '@/shared/api/marketplace-hooks'
import { Button } from '@/shared/ui/button'
import { LoginDialog } from '@/shared/ui/login-dialog'
import { HeaderSearch } from './header-search'
import { Newsletter } from './newsletter'
import { useHomeSection } from './use-home-section'
import { catalogSearchSchema } from '@/shared/contracts/marketplace'

export function MarketplaceLayout({ children }: { children: ReactNode }) {
  const isDetails = useLocation({
    select: (location) => location.pathname.startsWith('/nfts/'),
  })
  const isCatalog = useLocation({
    select: (location) => location.pathname === '/',
  })
  const session = useSession()
  const cart = useCart()
  const logout = useLogout()
  const [login, setLogin] = useState(false)
  const navigate = useNavigate()
  const path = useLocation({ select: (location) => location.pathname })
  const location = useLocation()
  const accountPath = [
    '/profile',
    '/wallets',
    '/favorites',
    '/orders',
  ].includes(path)
  const catalogVisible = useHomeSection(isCatalog, location.href)
  const marketActive =
    !accountPath &&
    (/^\/(nfts|cart|checkout|orders)(\/|$)/.test(path) || catalogVisible)
  const homeActive = (isCatalog && !marketActive) || accountPath
  const isAuth = path === '/login' || path === '/register'
  const count =
    cart.data?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0
  return (
    <div
      className={`marketplace ${isDetails ? 'is-details' : ''} ${isCatalog ? 'is-catalog' : ''} ${isAuth ? 'is-auth' : ''} ${path === '/cart' ? 'is-cart' : ''}`}
    >
      <a className="skip-link" href="#main-content">
        Ir para conteúdo
      </a>
      <header className="site-header">
        <Link to="/" className="wordmark">
          KURIO
        </Link>
        <nav aria-label="Principal">
          <Link
            to="/"
            search={catalogSearchSchema.parse({})}
            hash=""
            activeOptions={{ exact: true }}
            aria-current={homeActive ? 'page' : undefined}
            data-active={homeActive}
          >
            Início
          </Link>
          <Link
            to="/"
            hash="catalog"
            search={catalogSearchSchema.parse({})}
            onClick={(event) => {
              if (isCatalog && location.hash === 'catalog') {
                event.preventDefault()
                document
                  .getElementById('catalog')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
            }}
            aria-current={marketActive ? 'page' : undefined}
            data-active={marketActive}
          >
            Mercado
          </Link>
          <span aria-disabled="true">Criadores</span>
          <span aria-disabled="true">Aprenda</span>
        </nav>
        <div className="header-actions">
          <HeaderSearch />
          <button
            aria-label={`Carrinho, ${count} itens`}
            onClick={() => void navigate({ to: '/cart' })}
            className="cart-icon"
          >
            <span className="cart-glyph">
              <img
                src="/assets/figma/imgCartIcon.svg"
                alt=""
                width={24}
                height={24}
              />
              <span className="cart-count" aria-hidden="true">
                {count}
              </span>
            </span>
          </button>
          {session.data?.user && (
            <Link
              className="account-entry"
              to="/profile"
              aria-label="Minha conta"
            >
              <UserRound size={20} />
            </Link>
          )}
          {session.data?.user ? (
            <Button onClick={() => logout.mutate()} disabled={logout.isPending}>
              Sair
            </Button>
          ) : (
            <Button onClick={() => setLogin(true)}>
              <img
                src="/assets/figma/imgLogout.svg"
                alt=""
                width={17.7779}
                height={16.9167}
              />
              Entrar
            </Button>
          )}
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <footer className="site-footer">
        <div className="footer-benefits">
          <div>
            <i>W</i>
            <h3>Segurança da carteira</h3>
            <p>
              Proteja sua carteira e colecione arte digital verificada com
              confiança.
            </p>
          </div>
          <div>
            <i>C</i>
            <h3>Criadores em destaque</h3>
            <p>
              Conheça artistas, estúdios e comunidades que moldam a cultura
              digital na rede.
            </p>
          </div>
          <div>
            <i>D</i>
            <h3>Alertas de lançamentos</h3>
            <p>
              Receba calendários de cunhagem, novidades de listas de acesso e
              análises de mercado.
            </p>
          </div>
          <div>
            <h3>Antecipe-se ao próximo lançamento</h3>
            <p>Novidades da Kurio em breve.</p>
            <Newsletter />
          </div>
        </div>
        <div className="brand-band">
          <b>KURIO</b>
          <span>
            Feita para colecionadores,
            <br />
            criadores e cultura
          </span>
          <span>contato@email.com</span>
          <span>+55 11 4002 8922</span>
        </div>
        <div className="footer-columns">
          <div>
            <h3>Meu perfil</h3>
            <Link to="/profile">Meu perfil</Link>
            <span>Minha coleção</span>
            <Link to="/orders">Pedidos</Link>
            <span>Estúdio do criador</span>
            <Link to="/favorites">Lista de interesses</Link>
          </div>
          <div>
            <h3>Central de ajuda</h3>
            <span>Central de ajuda</span>
            <span>Como comprar NFTs</span>
            <Link to="/wallets">Carteiras</Link>
            <span>Política do mercado</span>
            <span>Denunciar item</span>
          </div>
          <div>
            <h3>Coleções</h3>
            <Link
              to="/"
              hash="catalog"
              search={catalogSearchSchema.parse({ category: 'digital-art' })}
            >
              Arte digital
            </Link>
            <Link
              to="/"
              hash="catalog"
              search={catalogSearchSchema.parse({ category: 'photography' })}
            >
              Fotografia
            </Link>
            <Link
              to="/"
              hash="catalog"
              search={catalogSearchSchema.parse({ category: 'music' })}
            >
              Música
            </Link>
            <Link
              to="/"
              hash="catalog"
              search={catalogSearchSchema.parse({ category: '3d' })}
            >
              Arte 3D
            </Link>
            <Link
              to="/"
              hash="catalog"
              search={catalogSearchSchema.parse({ category: 'utility' })}
            >
              Utilidade
            </Link>
          </div>
          <div>
            <h3>Redes sociais</h3>
            <div className="social-icons">
              {[
                ['imgFrame108', 'Facebook', 'https://www.facebook.com/'],
                ['imgFrame109', 'Instagram', 'https://www.instagram.com/'],
                ['imgFrame110', 'X (Twitter)', 'https://x.com/'],
                ['imgFrame111', 'LinkedIn', 'https://www.linkedin.com/'],
                ['imgFrame112', 'YouTube', 'https://www.youtube.com/'],
              ].map(([name, label, href]) => (
                <a
                  key={name}
                  href={href}
                  aria-label={label}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img
                    src={`/assets/figma/${name}.svg`}
                    alt=""
                    width={30}
                    height={30}
                    loading="lazy"
                  />
                </a>
              ))}
            </div>
            <h3>Carteiras compatíveis</h3>
            <small>METAMASK • WALLETCONNECT • COINBASE</small>
          </div>
        </div>
        <p className="copyright">
          © 2026 Kurio. Propriedade digital para todos.
        </p>
      </footer>
      <nav className="mobile-nav" aria-label="Navegação móvel">
        <Link to="/" aria-label="Início">
          <Home size={21} fill="currentColor" />
        </Link>
        <button
          onClick={() => void navigate({ to: '/favorites' })}
          aria-label="Favoritos"
        >
          <Heart size={22} fill="currentColor" />
        </button>
        <span className="mobile-scan" role="img" aria-label="Explorar">
          <ScanLine size={27} />
        </span>
        <button
          className="cart-icon"
          aria-label={`Carrinho, ${count} itens`}
          onClick={() => void navigate({ to: '/cart' })}
        >
          <span className="cart-glyph">
            <ShoppingCart size={21} fill="currentColor" />
            <span className="cart-count" aria-hidden="true">
              {count}
            </span>
          </span>
        </button>
        <button
          onClick={() => void navigate({ to: '/profile' })}
          aria-label="Meu perfil"
        >
          <UserRound size={21} fill="currentColor" />
        </button>
      </nav>
      <LoginDialog open={login} onOpenChange={setLogin} />
    </div>
  )
}
