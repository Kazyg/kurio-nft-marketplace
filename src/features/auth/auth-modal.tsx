import { useRef, type ReactNode } from 'react'
import { Dialog } from '@/shared/ui/dialog'

export function AuthModal({
  open,
  onOpenChange,
  mode,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'login' | 'register'
  children: ReactNode
}) {
  const previousFocus = useRef<HTMLElement | null>(null)
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={mode === 'login' ? 'Entrar na Kurio' : 'Crie sua conta'}
      className={`auth-dialog auth-dialog-${mode}`}
      overlayClassName="auth-overlay"
      closeIcon={<img src="/assets/figma/auth-close.svg" alt="" />}
      onOpenAutoFocus={() => {
        previousFocus.current =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null
      }}
      onCloseAutoFocus={(event) => {
        if (previousFocus.current?.isConnected) {
          event.preventDefault()
          previousFocus.current.focus()
        }
      }}
    >
      {children}
    </Dialog>
  )
}
