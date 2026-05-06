import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { mockMarkPaid } from '../../api/client'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

function parseOrderSpec(searchParams) {
  const single = searchParams.get('orderId') ?? ''
  const multi = searchParams.get('orderIds') ?? ''
  if (multi.trim()) {
    const ids = multi
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => !Number.isNaN(n))
    if (ids.length) return { ids, label: ids.map((n) => `#${n}`).join(', ') }
  }
  if (single !== '') {
    const n = Number(single)
    if (!Number.isNaN(n)) return { ids: [n], label: `#${n}` }
  }
  return null
}

export default function MockCheckout() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const spec = useMemo(() => parseOrderSpec(searchParams), [searchParams])
  const valid = spec != null && spec.ids.length > 0

  const [error, setError] = useState(null)
  const [phase, setPhase] = useState('processing')

  useEffect(() => {
    if (!valid) return
    let cancelled = false
    let timeoutId
    ;(async () => {
      try {
        const result = await mockMarkPaid(spec.ids.length === 1 ? spec.ids[0] : spec.ids)
        if (cancelled) return
        if (result.orders && Array.isArray(result.orders)) {
          setPhase('done')
          const firstId = result.orders[0]?.id ?? spec.ids[0]
          timeoutId = window.setTimeout(() => {
            if (!cancelled) navigate(`/orders/${firstId}`, { replace: true })
          }, 900)
          return
        }
        setPhase('done')
        timeoutId = window.setTimeout(() => {
          if (!cancelled) navigate(`/orders/${spec.ids[0]}`, { replace: true })
        }, 900)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)))
      }
    })()
    return () => {
      cancelled = true
      if (timeoutId) window.clearTimeout(timeoutId)
    }
  }, [valid, navigate, spec])

  if (!valid) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <Card className="w-full max-w-md border-destructive/40 shadow-lg">
          <CardHeader>
            <CardTitle>Invalid link</CardTitle>
            <CardDescription>
              Missing or invalid order id(s). Use orderId=… or orderIds=1,2,3.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <Alert variant="destructive" className="max-w-md shadow-sm">
          <AlertTitle>Payment could not be confirmed</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center bg-gradient-to-b from-muted/50 to-background p-6">
      <Card className="w-full max-w-md border-border/80 shadow-lg">
        <CardHeader className="space-y-3 text-center">
          {phase === 'processing' ? (
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Loader2 className="size-8 animate-spin" aria-hidden />
            </div>
          ) : (
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-8" aria-hidden />
            </div>
          )}
          <CardTitle className="text-xl">
            {phase === 'processing' ? 'Confirming your payment' : 'Payment confirmed'}
          </CardTitle>
          <CardDescription className="text-base">
            {phase === 'processing'
              ? 'Please wait while we securely mark your order(s) as paid.'
              : 'Redirecting you to your order…'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-sm tabular-nums text-muted-foreground">
            {spec.ids.length === 1 ? `Order ${spec.label}` : `Orders ${spec.label}`}
          </p>
        </CardContent>
      </Card>
      <p className="mt-6 max-w-sm text-center text-xs text-muted-foreground">
        Demo checkout — no real card is charged. In production this step is handled by your payment provider.
      </p>
    </div>
  )
}
