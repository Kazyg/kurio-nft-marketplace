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
import { AccountLayout } from './account-layout'
import { safeReturnTo } from '@/shared/lib/redirect'
import {
  catalogSearchSchema,
  type CatalogSearch,
} from '@/shared/contracts/marketplace'

import {
  DiagnosticsPage,
  AuthRoute,
  CartPage,
  CheckoutPage,
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
const accountRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_account',
  component: AccountLayout,
})
const profileRoute = createRoute({
  getParentRoute: () => accountRoute,
  path: '/profile',
  beforeLoad: requireSession,
}).lazy(() => import('./profile-route.lazy').then((module) => module.Route))
const walletsRoute = createRoute({
  getParentRoute: () => accountRoute,
  path: '/wallets',
  beforeLoad: requireSession,
}).lazy(() => import('./wallets-route.lazy').then((module) => module.Route))
const favoritesRoute = createRoute({
  getParentRoute: () => accountRoute,
  path: '/favorites',
  beforeLoad: requireSession,
}).lazy(() => import('./favorites-route.lazy').then((module) => module.Route))
const ordersRoute = createRoute({
  getParentRoute: () => accountRoute,
  path: '/orders',
  beforeLoad: requireSession,
}).lazy(() => import('./orders-route.lazy').then((module) => module.Route))
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
    accountRoute.addChildren([
      profileRoute,
      walletsRoute,
      favoritesRoute,
      ordersRoute,
    ]),
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
