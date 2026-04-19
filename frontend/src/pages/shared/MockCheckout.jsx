import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { mockMarkPaid } from '../../api/client'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export default function MockCheckout() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const orderIdRaw = searchParams.get('orderId') ?? ''
  const parsed = orderIdRaw !== '' ? Number(orderIdRaw) : NaN
  const valid = orderIdRaw !== '' && !Number.isNaN(parsed)

  const [error, setError] = useState(null)

  useEffect(() => {
    if (!valid) return
    let cancelled = false
    ;(async () => {
      try {
        await mockMarkPaid(parsed)
        if (cancelled) return
        navigate(`/orders/${parsed}`, { replace: true })
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [valid, parsed, navigate])

  if (!orderIdRaw) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTitle>Invalid link</AlertTitle>
          <AlertDescription>Missing orderId query parameter.</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!valid) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTitle>Invalid link</AlertTitle>
          <AlertDescription>orderId must be a number.</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4 p-6">
        <Alert variant="destructive">
          <AlertTitle>Mock checkout failed</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-6">
      <p className="text-sm text-muted-foreground">Confirming mock payment…</p>
    </div>
  )
}
