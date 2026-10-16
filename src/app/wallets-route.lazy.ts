import { createLazyRoute } from '@tanstack/react-router'
import { WalletsPage } from '@/features/wallets/wallets-page'

export const Route = createLazyRoute('/_account/wallets')({
  component: WalletsPage,
})
