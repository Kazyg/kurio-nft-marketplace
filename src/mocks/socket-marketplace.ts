import type { toSocketIo } from '@mswjs/socket.io-binding'
import type { WebSocketHandlerConnection } from 'msw'
import { z } from 'zod'
import { realtimeSnapshot, transaction } from './repository'
import type { DomainEvent } from '@/shared/contracts/realtime'

type Client = ReturnType<typeof toSocketIo>['client']
const connections = new Set<{
  close: () => void
  replay: (event: DomainEvent) => void
}>()

export function bindMarketplaceSocket(
  connection: WebSocketHandlerConnection,
  client: Client,
) {
  let token: string | null = null
  let userId: string | null = null
  let subscriptionId = ''
  let sequence = 0
  let closed = false
  let busy = false
  const emit = (event: DomainEvent) => {
    if (event.type === 'order.updated' && event.userId !== userId) return
    client.emit(event.type, { ...event, subscriptionId })
  }
  const control = {
    close: () =>
      connection.client.close(1012, 'Simulated transport interruption'),
    replay: emit,
  }
  connections.add(control)
  client.on('marketplace:subscribe', async (_event, input: unknown) => {
    const parsed = z
      .object({
        accessToken: z.string().nullable(),
        subscriptionId: z.string().uuid(),
      })
      .safeParse(input)
    if (!parsed.success || closed) return
    const snapshot = await realtimeSnapshot(parsed.data.accessToken)
    if (closed) return
    token = parsed.data.accessToken
    userId = snapshot.userId
    subscriptionId = parsed.data.subscriptionId
    sequence = snapshot.sequence
    client.emit('marketplace:ready', { subscriptionId, userId })
  })
  const timer = window.setInterval(async () => {
    if (!subscriptionId || busy || closed) return
    busy = true
    try {
      const snapshot = await realtimeSnapshot(token, sequence)
      if (closed) return
      if (snapshot.userId !== userId) {
        userId = null
        client.emit('marketplace:expired', { subscriptionId })
        connection.client.close(1008, 'Session expired')
        return
      }
      snapshot.events.forEach(emit)
      sequence = snapshot.sequence
    } finally {
      busy = false
    }
  }, 300)
  connection.client.addEventListener('close', () => {
    closed = true
    window.clearInterval(timer)
    connections.delete(control)
  })
}

export async function controlMarketplaceSockets(input: {
  action: 'disconnect' | 'replay'
  eventId?: string
  reverse?: boolean
}) {
  if (input.action === 'disconnect') {
    connections.forEach((connection) => connection.close())
    return { ok: true }
  }
  const events = await transaction((state) =>
    state.events.filter(
      (event) => !input.eventId || event.eventId === input.eventId,
    ),
  )
  if (input.reverse) events.reverse()
  for (const event of events)
    connections.forEach((connection) => connection.replay(event))
  return { ok: true, events: events.length }
}
