import { z } from 'zod'
export const diagnosticSchema = z.object({
  status: z.literal('ok'),
  source: z.literal('msw-http'),
  timestamp: z.string().datetime(),
})
export const socketDiagnosticSchema = z.object({
  status: z.literal('ok'),
  source: z.literal('msw-socket.io'),
  requestId: z.string().uuid(),
  timestamp: z.string().datetime(),
})
export type SocketDiagnostic = z.infer<typeof socketDiagnosticSchema>
export interface ServerToClientEvents {
  'diagnostic:result': (payload: SocketDiagnostic) => void
}
export interface ClientToServerEvents {
  'diagnostic:request': (payload: { requestId: string }) => void
}
