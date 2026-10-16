import { lazy } from 'react'

export const MarketplaceRealtime = lazy(() =>
  import('@/shared/realtime/marketplace-realtime').then((module) => ({
    default: module.MarketplaceRealtime,
  })),
)

export const DiagnosticsPage = lazy(() =>
  import('@/features/diagnostics/page').then((module) => ({
    default: module.DiagnosticsPage,
  })),
)
export const AuthRoute = lazy(() =>
  import('./phase-three-pages').then((module) => ({
    default: module.AuthRoute,
  })),
)
export const FavoritesRoute = lazy(() =>
  import('./phase-three-pages').then((module) => ({
    default: module.FavoritesRoute,
  })),
)
export const CartPage = lazy(() =>
  import('@/features/cart/cart-page').then((module) => ({
    default: module.CartPage,
  })),
)
export const ProfilePage = lazy(() =>
  import('@/features/profile/profile-page').then((module) => ({
    default: module.ProfilePage,
  })),
)
export const WalletsPage = lazy(() =>
  import('@/features/wallets/wallets-page').then((module) => ({
    default: module.WalletsPage,
  })),
)
export const CheckoutPage = lazy(() =>
  import('@/features/checkout/checkout-page').then((module) => ({
    default: module.CheckoutPage,
  })),
)
export const OrdersPage = lazy(() =>
  import('@/features/orders/orders-page').then((module) => ({
    default: module.OrdersPage,
  })),
)
export const OrderPage = lazy(() =>
  import('@/features/orders/orders-page').then((module) => ({
    default: module.OrderPage,
  })),
)
