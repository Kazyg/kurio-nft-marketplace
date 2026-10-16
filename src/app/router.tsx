import { Suspense } from 'react'
import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  type SearchSchemaInput,
} from '@tanstack/react-router'
import { CatalogRoute } from './route-pages'
import { parseSearch, stringifySearch } from './search-params'
import { MarketplaceLayout } from '@/shared/layout/marketplace-layout'
import { Button } from '@/shared/ui/button'
import { SessionLifecycle } from './session-lifecycle'
import { requireSession } from './private-route'
import { RouteError } from './route-error'
import { RoutePending } from './route-pending'
import { safeReturnTo } from '@/shared/lib/redirect'
import {
  catalogSearchSchema,
  type CatalogSearch,
} from '@/shared/contracts/marketplace'

import {
  DiagnosticsPage,
  AuthRoute,
  FavoritesRoute,
  CartPage,
  ProfilePage,
  WalletsPage,
  CheckoutPage,
  OrdersPage,
  OrderPage,
  MarketplaceRealtime,
} from './lazy-pages'

const rootRoute = createRootRoute({
  errorComponent: RouteError,
  component: () => (
    <>
      <SessionLifecycle />
      <Suspense fallback={null}>
        <MarketplaceRealtime />
      </Suspense>
      <MarketplaceLayout>
        <Suspense fallback={<RoutePending />}>
          <Outlet />
        </Suspense>
      </MarketplaceLayout>
    </>
  ),
  notFoundComponent: () => (
    <section className="mx-auto max-w-[1200px] space-y-6 px-6 py-16">
      <h1 className="text-3xl font-bold">Página não encontrada</h1>
      <Button asChild>
        <Link to="/">Voltar ao início</Link>
      </Button>
    </section>
  ),
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: (search: Partial<CatalogSearch> & SearchSchemaInput) =>
    catalogSearchSchema.parse(search),
  component: CatalogRoute,
})
const detailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/nfts/$nftId',
  pendingComponent: RoutePending,
  pendingMs: 0,
  pendingMinMs: 0,
}).lazy(() => import('./nft-route.lazy').then((module) => module.Route))
const diagnosticRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/diagnostics',
  component: () => (
    <div className="mx-auto max-w-[1200px] px-6 py-12">
      <DiagnosticsPage />
    </div>
  ),
})
const validateAuthSearch = (
  search: { redirect?: string } & SearchSchemaInput,
) => ({ redirect: safeReturnTo(search.redirect) })
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: validateAuthSearch,
  component: AuthRoute,
})
const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/register',
  validateSearch: validateAuthSearch,
  component: AuthRoute,
})
const cartRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/cart',
  component: CartPage,
})
const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profile',
  beforeLoad: requireSession,
  component: ProfilePage,
})
const walletsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/wallets',
  beforeLoad: requireSession,
  component: WalletsPage,
})
const favoritesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/favorites',
  beforeLoad: requireSession,
  component: FavoritesRoute,
})
const ordersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/orders',
  beforeLoad: requireSession,
  component: OrdersPage,
})
const orderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/orders/$orderId',
  beforeLoad: requireSession,
  component: () => <OrderPage orderId={orderRoute.useParams().orderId} />,
})
const checkoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/checkout',
  beforeLoad: requireSession,
  component: CheckoutPage,
})
export const router = createRouter({
  parseSearch,
  stringifySearch,
  routeTree: rootRoute.addChildren([
    indexRoute,
    detailRoute,
    diagnosticRoute,
    loginRoute,
    registerRoute,
    cartRoute,
    profileRoute,
    walletsRoute,
    favoritesRoute,
    ordersRoute,
    orderRoute,
    checkoutRoute,
  ]),
  scrollRestoration: true,
})
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
