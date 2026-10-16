import { marketplaceHandlers } from './marketplace-handlers'
import { http, HttpResponse, ws } from 'msw'
import { toSocketIo } from '@mswjs/socket.io-binding'
import { z } from 'zod'
import { env } from '@/shared/config/env'
import {
  bindMarketplaceSocket,
  controlMarketplaceSockets,
} from './socket-marketplace'
const socketUrl = new URL('/', env.VITE_SOCKET_URL || window.location.origin)
socketUrl.protocol = socketUrl.protocol === 'https:' ? 'wss:' : 'ws:'
const socket = ws.link(socketUrl.href)
const apiUrl = new URL(
  env.VITE_API_BASE_URL,
  window.location.origin,
).href.replace(/\/$/, '')
export const handlers = [
  http.post(`${apiUrl}/__mock/realtime`, async ({ request }) => {
    const input = z
      .object({
        action: z.enum(['disconnect', 'replay']),
        eventId: z.string().optional(),
        reverse: z.boolean().optional(),
      })
      .safeParse(await request.json())
    if (!input.success)
      return HttpResponse.json(
        { error: 'Invalid realtime control' },
        { status: 422 },
      )
    return HttpResponse.json(await controlMarketplaceSockets(input.data))
  }),
  http.get(`${apiUrl}/diagnostics`, () =>
    HttpResponse.json(
      { status: 'ok', source: 'msw-http', timestamp: new Date().toISOString() },
      { headers: { 'X-Kurio-Mock': 'msw' } },
    ),
  ),
  socket.addEventListener('connection', (connection) => {
    const { client } = toSocketIo(connection)
    bindMarketplaceSocket(connection, client)
    const heartbeat = window.setInterval(
      () => connection.client.send('2'),
      20_000,
    )
    connection.client.addEventListener('close', () =>
      window.clearInterval(heartbeat),
    )
    client.on('diagnostic:request', (_event, payload: unknown) => {
      const { requestId } = z
        .object({ requestId: z.string().uuid() })
        .parse(payload)
      client.emit('diagnostic:result', {
        status: 'ok',
        source: 'msw-socket.io',
        requestId,
        timestamp: new Date().toISOString(),
      })
    })
  }),
]

handlers.push(...marketplaceHandlers(apiUrl))
