import { useEffect, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { env } from '@/shared/config/env'
import {
  socketDiagnosticSchema,
  type SocketDiagnostic,
  type ServerToClientEvents,
  type ClientToServerEvents,
} from './contracts'
type State = {
  status: 'connecting' | 'success' | 'error'
  data?: SocketDiagnostic
  error?: string
}
export function useSocketDiagnostic() {
  const [state, setState] = useState<State>({ status: 'connecting' })
  useEffect(() => {
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
      env.VITE_SOCKET_URL || window.location.origin,
      {
        transports: ['websocket'],
        autoConnect: false,
        reconnection: false,
        timeout: 8_000,
      },
    )
    const requestId = crypto.randomUUID()
    const timer = window.setTimeout(
      () =>
        setState({
          status: 'error',
          error: 'Tempo limite para o evento Socket.IO.',
        }),
      10_000,
    )
    socket.on('connect', () => socket.emit('diagnostic:request', { requestId }))
    socket.on('diagnostic:result', (payload) => {
      const result = socketDiagnosticSchema.safeParse(payload)
      if (!result.success || result.data.requestId !== requestId) {
        setState({ status: 'error', error: 'Resposta Socket.IO inválida.' })
      } else {
        setState({ status: 'success', data: result.data })
      }
      window.clearTimeout(timer)
    })
    socket.on('connect_error', (error) => {
      window.clearTimeout(timer)
      setState({ status: 'error', error: error.message })
    })
    socket.on('disconnect', (reason) =>
      setState({ status: 'error', error: reason }),
    )
    socket.connect()
    return () => {
      window.clearTimeout(timer)
      socket.removeAllListeners()
      socket.disconnect()
    }
  }, [])
  return state
}
