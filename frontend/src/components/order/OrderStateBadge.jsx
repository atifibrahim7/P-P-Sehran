import { cn } from '@/lib/utils'

const stateStyles = {
  pending: 'border-amber-500/30 bg-amber-500/5 text-amber-900 dark:text-amber-100',
  paid: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-900 dark:text-emerald-100',
  processing: 'border-blue-500/30 bg-blue-500/5 text-blue-900 dark:text-blue-100',
  completed: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-900 dark:text-emerald-100',
}

export default function OrderStateBadge({ state, className }) {
  const s = String(state || '').toLowerCase()
  const label = s.charAt(0).toUpperCase() + s.slice(1)
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        stateStyles[s] ?? 'border-border bg-muted/50 text-foreground',
        className,
      )}
    >
      {label}
    </span>
  )
}
