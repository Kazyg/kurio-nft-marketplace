import { AuthForm } from '@/features/auth/auth-page'
import { AuthModal } from '@/features/auth/auth-modal'

export default function LoginDialogContent({
  mode,
  onModeChange,
  onOpenChange,
  onSuccess,
}: {
  mode: 'login' | 'register'
  onModeChange: (mode: 'login' | 'register') => void
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}) {
  return (
    <AuthModal open onOpenChange={onOpenChange} mode={mode}>
      <AuthForm
        mode={mode}
        onModeChange={onModeChange}
        onSuccess={() => {
          onOpenChange(false)
          onSuccess?.()
        }}
      />
    </AuthModal>
  )
}
