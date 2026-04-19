import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getOrders, startCheckout } from '../../api/client'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function PatientRecommendations() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [payError, setPayError] = useState(null)
  const [cancelMsg, setCancelMsg] = useState(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getOrders()
      setOrders(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const cancelFlag = searchParams.get('cancel')
  useEffect(() => {
    if (cancelFlag !== '1') return
    setCancelMsg('Checkout canceled. Try Pay again when ready.')
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev)
        n.delete('cancel')
        return n
      },
      { replace: true },
    )
  }, [cancelFlag, setSearchParams])

  const pendingPatientOrders = useMemo(
    () => orders.filter((o) => o.type === 'patient' && o.state === 'pending'),
    [orders],
  )

  const pay = async (orderId) => {
    try {
      setPayError(null)
      const origin = window.location.origin
      const successUrl = `${origin}/orders/${orderId}?paid=1`
      const cancelUrl = `${origin}/patient/recommendations?cancel=1`
      await startCheckout(orderId, successUrl, cancelUrl)
    } catch (e) {
      setPayError(e instanceof Error ? e : new Error(String(e)))
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Patient · Recommendations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Orders your practitioner set up for you. Complete payment here when you&apos;re ready.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : null}
      {payError ? (
        <Alert variant="destructive">
          <AlertTitle>Checkout</AlertTitle>
          <AlertDescription>{payError.message}</AlertDescription>
        </Alert>
      ) : null}
      {cancelMsg ? (
        <Alert>
          <AlertTitle>Canceled</AlertTitle>
          <AlertDescription>{cancelMsg}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="border-border/80 shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Awaiting payment ({pendingPatientOrders.length})</CardTitle>
          <CardDescription>Totals shown are what you pay. Pay to confirm your order.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !pendingPatientOrders.length ? (
            <p className="text-sm text-muted-foreground">No pending orders from your practitioner.</p>
          ) : (
            <ul className="space-y-3">
              {pendingPatientOrders.map((o) => (
                <li
                  key={o.id}
                  className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <Link to={`/orders/${o.id}`} className="font-medium text-primary underline-offset-4 hover:underline">
                      Order #{o.id}
                    </Link>
                    <p className="text-sm text-muted-foreground">Total due: ${Number(o.total_patient ?? 0).toFixed(2)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      to={`/orders/${o.id}`}
                      className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'inline-flex no-underline')}
                    >
                      Details
                    </Link>
                    <Button type="button" size="sm" onClick={() => pay(o.id)}>
                      Pay now
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
