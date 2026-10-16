import type { ComponentProps } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/shared/lib/utils'
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring disabled:opacity-50 disabled:pointer-events-none',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-accent',
        outline: 'border border-border text-foreground hover:bg-card',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)
export function Button({
  className,
  variant,
  asChild = false,
  ...props
}: ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      className={
        className
          ? cn(buttonVariants({ variant, className }))
          : buttonVariants({ variant })
      }
      {...props}
    />
  )
}
