import { createLazyRoute } from '@tanstack/react-router'
import { OrdersPage } from '@/features/orders/orders-page'

export const Route = createLazyRoute('/_account/orders')({
  component: OrdersPage,
})
