import { useEffect, useState } from 'react'
import { useLocation } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { io } from 'socket.io-client'
import { z } from 'zod'
import { useSession } from '@/shared/api/marketplace-hooks'
import { getAccessToken } from '@/shared/api/identity'
import { marketplaceApi } from '@/shared/api/marketplace'
import { env } from '@/shared/config/env'
import type { Nft, NftList, Order } from '@/shared/contracts/marketplace'
import { latestNft, latestOrder, latestOrderList } from './reconcile'

const identity = {
  eventId: z.string().uuid(),
  sequence: z.number().int().positive(),
  version: z.number().int().positive(),
  updatedAt: z.string().datetime(),
  subscriptionId: z.string().uuid(),
}
const resource = z
  .object({
    id: z.string(),
    version: z.number().int().positive(),
    updatedAt: z.string().datetime(),
  })
  .passthrough()
const nftEvent = z.object({
  ...identity,
  type: z.literal('nft.updated'),
  nftId: z.string(),
  nft: resource.extend({
    priceEth: z.string().regex(/^\d+(\.\d{1,18})?$/),
    editions: z.array(
      resource.extend({
        available: z.number().int().nonnegative(),
        priceEth: z.string(),
      }),
    ),
  }),
})
const orderEvent = z.object({
  ...identity,
  type: z.literal('order.updated'),
  orderId: z.string(),
  userId: z.string(),
  order: resource.extend({
    userId: z.string(),
    status: z.enum(['pending', 'confirmed', 'declined']),
    snapshot: z
      .object({ lines: z.array(z.unknown()), totalEth: z.string() })
      .passthrough(),
  }),
})

export function MarketplaceRealtime() {
  const diagnostics = useLocation({
    select: (location) => location.pathname === '/diagnostics',
  })
  const session = useSession()
  const client = useQueryClient()
  const [status, setStatus] = useState('Conectando tempo real')
  const [received, setReceived] = useState(0)
  const [orderReceived, setOrderReceived] = useState(0)
  const [retry, setRetry] = useState(0)
  const [interrupted, setInterrupted] = useState(false)
  const token = session.data?.accessToken || null
  const userId = session.data?.user?.id || null
  useEffect(() => {
    if (!session.isSuccess) return
    let active = true
    let subscriptionId = ''
    const versions = new Map<string, number>()
    const socket = io(env.VITE_SOCKET_URL || window.location.origin, {
      transports: ['websocket'],
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 500,
      timeout: 8000,
    })
    const current = () => active && getAccessToken() === token
    const revalidate = () => {
      for (const root of ['catalog', 'nft', 'cart', 'quotes', 'orders'])
        void client.invalidateQueries({
          queryKey: [root],
          refetchType: 'active',
        })
    }
    socket.on('connect', async () => {
      if (!current()) return
      try {
        const latest = await client.fetchQuery({
          queryKey: ['auth', 'session'],
          queryFn: ({ signal }) => marketplaceApi.session(signal),
          staleTime: 0,
        })
        if (!current() || latest.user?.id !== (userId || undefined)) return
      } catch {
        if (current()) {
          setStatus('Erro ao revalidar a sessão de tempo real')
          setInterrupted(true)
        }
        return
      }
      subscriptionId = crypto.randomUUID()
      socket.emit('marketplace:subscribe', {
        accessToken: token,
        subscriptionId,
      })
    })
    socket.on('marketplace:ready', (input: unknown) => {
      const result = z
        .object({ subscriptionId: z.string(), userId: z.string().nullable() })
        .safeParse(input)
      if (
        !current() ||
        !result.success ||
        result.data.subscriptionId !== subscriptionId ||
        result.data.userId !== userId
      )
        return
      setStatus('Tempo real conectado')
      setInterrupted(false)
      revalidate()
    })
    socket.on('nft.updated', (input: unknown) => {
      const result = nftEvent.safeParse(input)
      if (
        !current() ||
        !result.success ||
        result.data.subscriptionId !== subscriptionId
      )
        return
      const event = result.data
      if (event.nft.id !== event.nftId || event.nft.version !== event.version)
        return
      const key = `nft:${event.nftId}`
      if ((versions.get(key) || 0) >= event.version) return
      versions.set(key, event.version)
      const nft = event.nft as unknown as Nft
      client.setQueriesData<Nft>(
        { queryKey: ['nft', event.nftId] },
        (previous) => (previous ? latestNft(previous, nft) : previous),
      )
      client.setQueriesData<NftList>(
        { queryKey: ['catalog', 'list'] },
        (previous) =>
          previous
            ? {
                ...previous,
                items: previous.items.map((item) =>
                  item.id === nft.id ? latestNft(item, nft) : item,
                ),
              }
            : previous,
      )
      for (const root of ['catalog', 'nft', 'cart', 'quotes'])
        void client.invalidateQueries({ queryKey: [root] })
      setReceived((count) => count + 1)
    })
    socket.on('order.updated', (input: unknown) => {
      const result = orderEvent.safeParse(input)
      if (
        !current() ||
        !result.success ||
        result.data.subscriptionId !== subscriptionId
      )
        return
      const event = result.data
      if (
        event.userId !== userId ||
        event.order.userId !== userId ||
        event.order.id !== event.orderId ||
        event.order.version !== event.version
      )
        return
      const key = `order:${event.orderId}`
      if ((versions.get(key) || 0) >= event.version) return
      versions.set(key, event.version)
      const order = event.order as unknown as Order
      client.setQueryData<Order>(
        ['orders', userId, 'detail', order.id],
        (previous) => latestOrder(previous, order),
      )
      client.setQueriesData<Order[]>(
        { queryKey: ['orders', userId, 'list'] },
        (previous) =>
          previous
            ? latestOrderList(
                previous,
                previous.some((item) => item.id === order.id)
                  ? previous.map((item) =>
                      item.id === order.id ? order : item,
                    )
                  : [order, ...previous],
              )
            : previous,
      )
      for (const root of ['orders', 'cart', 'quotes', 'nft', 'catalog'])
        void client.invalidateQueries({ queryKey: [root] })
      setReceived((count) => count + 1)
      setOrderReceived((count) => count + 1)
    })
    socket.on('marketplace:expired', () => {
      if (current())
        void client.invalidateQueries({ queryKey: ['auth', 'session'] })
    })
    socket.on('disconnect', () => {
      if (active) {
        setStatus('Tempo real desconectado; reconciliando ao reconectar')
        setInterrupted(true)
      }
    })
    socket.on('connect_error', () => {
      if (active) {
        setStatus('Erro na conexão de tempo real')
        setInterrupted(true)
      }
    })
    socket.connect()
    return () => {
      active = false
      socket.removeAllListeners()
      socket.disconnect()
    }
  }, [client, token, userId, session.isSuccess, retry])
  return (
    <aside
      className={diagnostics || interrupted ? 'realtime-indicator' : 'sr-only'}
      aria-label="Conexão de tempo real"
      data-testid="realtime-notice"
    >
      <p
        aria-live={diagnostics || interrupted ? 'polite' : 'off'}
        data-testid="realtime-status"
        data-events={received}
        data-order-events={orderReceived}
        data-user-id={userId || 'guest'}
      >
        {status}
      </p>
      {(diagnostics || interrupted) && status !== 'Tempo real conectado' && (
        <button type="button" onClick={() => setRetry((value) => value + 1)}>
          Reconectar tempo real
        </button>
      )}
    </aside>
  )
}
