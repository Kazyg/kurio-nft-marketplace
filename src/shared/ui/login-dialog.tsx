import { lazy, Suspense, useState } from 'react'

const LoginDialogContent = lazy(() => import('./login-dialog-content'))

export function LoginDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  if (!open) return null
  return (
    <Suspense fallback={<span role="status">Carregando formulário…</span>}>
      <LoginDialogContent
        onOpenChange={onOpenChange}
        mode={mode}
        onModeChange={setMode}
        onSuccess={onSuccess}
      />
    </Suspense>
  )
}
