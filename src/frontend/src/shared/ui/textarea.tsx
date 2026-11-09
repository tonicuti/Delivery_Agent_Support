import type { ComponentProps } from 'react'
import { cn } from '@/shared/lib/utils'

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'flex min-h-16 w-full rounded-sm border border-border bg-card px-2.5 py-2 text-sm text-foreground transition-colors duration-150',
        'placeholder:text-muted-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'cursor-text resize-none',
        className,
      )}
      {...props}
    />
  )
}
