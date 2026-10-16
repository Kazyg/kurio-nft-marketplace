import { useRouter, type ErrorComponentProps } from '@tanstack/react-router'
import { apiErrorMessage } from '@/shared/api/marketplace'
import { Button } from '@/shared/ui/button'

export function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  return (
    <section className="account-shell" role="alert">
      <h1>Não foi possível abrir a página</h1>
      <p>{apiErrorMessage(error)}</p>
      <Button onClick={() => void router.invalidate().then(reset)}>
        Tentar novamente
      </Button>
    </section>
  )
}
