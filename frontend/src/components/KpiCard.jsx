import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/**
 * @param {'primary' | 'secondary'} colorKey
 */
export default function KpiCard({ title, value, subtitle, icon: Icon, colorKey = 'primary' }) {
  const tint = colorKey === 'secondary' ? 'text-secondary' : 'text-primary'
  const bgTint = colorKey === 'secondary' ? 'bg-secondary/15' : 'bg-primary/10'

  return (
    <Card className="h-full border-border/80 shadow-none">
      <CardContent className="flex flex-col gap-3 pt-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
            <p className="mt-1 break-words text-2xl font-semibold tracking-tight">{value}</p>
            {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
          {Icon ? (
            <div
              className={cn(
                'flex size-11 shrink-0 items-center justify-center rounded-lg',
                bgTint,
                tint,
              )}
            >
              <Icon className="size-4" />
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
