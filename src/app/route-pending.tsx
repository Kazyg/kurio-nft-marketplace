export function RoutePending() {
  return (
    <section
      role="status"
      aria-label="Carregando página"
      style={{ minHeight: '100svh' }}
    >
      <span className="sr-only">Carregando página…</span>
    </section>
  )
}
