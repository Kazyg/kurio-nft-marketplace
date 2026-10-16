import { useQuery } from '@tanstack/react-query'
import type { Order } from '@/shared/contracts/marketplace'
import { useSession } from './marketplace-hooks'
import { marketplaceApi } from './marketplace'
import { latestOrder, latestOrderList } from '@/shared/realtime/reconcile'

export const ordersKeys = {
  all: ['orders'] as const,
  list: (userId?: string) => ['orders', userId, 'list'] as const,
  detail: (userId: string | undefined, id: string) =>
    ['orders', userId, 'detail', id] as const,
}

export function preserveOrder(
  previous: Order | undefined,
  incoming: Order,
): Order {
  return latestOrder(previous, incoming)
}

export function useOrders() {
  const session = useSession()
  const userId = session.data?.user?.id
  return useQuery({
    queryKey: ordersKeys.list(userId),
    queryFn: ({ signal }) => marketplaceApi.orders(signal),
    enabled: !!userId,
    refetchInterval: (query) =>
      query.state.data?.some((order) => order.status === 'pending')
        ? 2000
        : false,
    structuralSharing: (oldData, newData) => {
      const previous = oldData as Order[] | undefined
      return latestOrderList(previous, newData as Order[])
    },
  })
}

export function useOrder(id: string) {
  const session = useSession()
  const userId = session.data?.user?.id
  return useQuery({
    queryKey: ordersKeys.detail(userId, id),
    queryFn: ({ signal }) => marketplaceApi.getOrder(id, signal),
    enabled: !!userId && !!id,
    refetchInterval: (query) =>
      query.state.data?.status === 'pending' ? 1500 : false,
    structuralSharing: (oldData, newData) =>
      preserveOrder(oldData as Order | undefined, newData as Order),
  })
}
