import { useQuery } from '@tanstack/react-query'
import { Radio, RefreshCw } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { diagnosticQuery } from './api'
import { useSocketDiagnostic } from './use-socket-diagnostic'
export function DiagnosticsPage() {
  const http = useQuery(diagnosticQuery)
  const socket = useSocketDiagnostic()
  return (
    <section className="space-y-8">
      <div>
        <p className="text-accent text-sm">INFRAESTRUTURA / 01</p>
        <h1 className="mt-3 text-3xl font-bold">Diagnóstico de rede</h1>
        <p className="mt-4 text-muted-foreground">
          Validação de Axios + MSW e Socket.IO pelo transporte WebSocket.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <article
          className="rounded-lg border border-border bg-card p-6"
          aria-labelledby="http-title"
        >
          <h2 id="http-title" className="text-xl font-bold">
            HTTP · Axios
          </h2>
          <p role="status" data-testid="http-status" className="my-4">
            {http.isSuccess
              ? 'HTTP conectado'
              : http.isError
                ? 'HTTP falhou'
                : 'Conectando HTTP…'}
          </p>
          {http.data && (
            <pre className="overflow-auto text-xs text-muted-foreground">
              {JSON.stringify(http.data, null, 2)}
            </pre>
          )}
          {http.error && <p role="alert">{http.error.message}</p>}
          <Button
            className="mt-6"
            disabled={http.isFetching}
            onClick={() => void http.refetch()}
          >
            <RefreshCw size={16} aria-hidden="true" />
            Repetir HTTP
          </Button>
        </article>
        <article
          className="rounded-lg border border-border bg-card p-6"
          aria-labelledby="socket-title"
        >
          <h2
            id="socket-title"
            className="flex items-center gap-2 text-xl font-bold"
          >
            <Radio size={20} aria-hidden="true" />
            Socket.IO
          </h2>
          <p role="status" data-testid="socket-status" className="my-4">
            {socket.status === 'success'
              ? 'Socket.IO conectado'
              : socket.status === 'error'
                ? 'Socket.IO falhou'
                : 'Conectando Socket.IO…'}
          </p>
          {socket.data && (
            <pre
              data-testid="socket-payload"
              className="overflow-auto text-xs text-muted-foreground"
            >
              {JSON.stringify(socket.data, null, 2)}
            </pre>
          )}
          {socket.error && <p role="alert">{socket.error}</p>}
        </article>
      </div>
      <p className="text-sm text-muted-foreground">
        Página técnica inicial. As telas do marketplace serão implementadas nas
        próximas etapas.
      </p>
    </section>
  )
}
