import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/**
 * @param {'primary' | 'secondary'} colorKey
 */
export default function KpiCard({ title, value, subtitle, icon: Icon, colorKey = 'primary' }) {
  const iconBg = colorKey === 'secondary' ? 'bg-secondary/80' : 'bg-primary/10'
  const iconColor = colorKey === 'secondary' ? 'text-secondary-foreground' : 'text-primary'

  return (
    <Card className="h-full border-border/70 shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="flex flex-col gap-3 pt-5 pb-4 px-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{title}</p>
            <p className="mt-1.5 break-words text-2xl font-bold tracking-tight text-foreground">{value}</p>
            {subtitle ? <p className="mt-1 text-xs text-muted-foreground leading-snug">{subtitle}</p> : null}
          </div>
          {Icon ? (
            <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', iconBg, iconColor)}>
              <Icon className="size-4.5" />
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
