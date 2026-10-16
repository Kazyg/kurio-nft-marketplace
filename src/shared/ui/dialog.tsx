import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useRef, type ReactNode } from 'react'

export function Dialog({
  open,
  onOpenChange,
  title,
  children,
  className = '',
  onCloseAutoFocus,
  onOpenAutoFocus,
  closeIcon,
  overlayClassName = '',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: ReactNode
  className?: string
  onCloseAutoFocus?: (event: Event) => void
  onOpenAutoFocus?: (event: Event) => void
  closeIcon?: ReactNode
  overlayClassName?: string
}) {
  const previousFocus = useRef<HTMLElement | null>(null)
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={`dialog-overlay ${overlayClassName}`}
        />
        <DialogPrimitive.Content
          className={`dialog-content ${className}`}
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            onCloseAutoFocus?.(event)
            if (!event.defaultPrevented && previousFocus.current?.isConnected) {
              event.preventDefault()
              previousFocus.current.focus()
            }
          }}
          onOpenAutoFocus={(event) => {
            previousFocus.current =
              document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null
            onOpenAutoFocus?.(event)
          }}
        >
          <DialogPrimitive.Title className="dialog-title">
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Close className="dialog-close" aria-label="Fechar">
            {closeIcon ?? <X size={20} />}
          </DialogPrimitive.Close>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
