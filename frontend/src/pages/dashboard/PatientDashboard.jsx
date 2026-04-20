import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ClipboardList, FlaskConical, Loader2, ShoppingCart, Sparkles, Stethoscope, UserRound } from 'lucide-react'
import { api, getCart, getOrders, startCheckout } from '../../api/client'
import KpiCard from '../../components/KpiCard.jsx'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

function patientLineTotal(it) {
  const p = it.product
  const q = Number(it.quantity) || 0
  return Number(p?.patient_price ?? p?.price ?? 0) * q
}

export default function PatientDashboard() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)
  const [payError, setPayError] = useState(null)
  const [cancelMsg, setCancelMsg] = useState(null)
  const [payingOrderId, setPayingOrderId] = useState(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [orders, results, cartRes] = await Promise.all([getOrders(), api('/lab/results'), getCart()])
      const orderList = Array.isArray(orders) ? orders : []
      const openOrders = orderList.filter((o) => String(o.state).toLowerCase() !== 'paid').length
      const cartItems = cartRes?.cart?.items ?? []
      const suggestedCartItems = cartItems.filter((i) => i.addedBy === 'practitioner')
      const mine = cartItems.filter((i) => i.addedBy === 'patient').length
      const pendingPatientOrders = orderList.filter((o) => o.type === 'patient' && o.state === 'pending')
      const suggestedTotal = suggestedCartItems.reduce((acc, it) => acc + patientLineTotal(it), 0)

        setData({
          orders: orderList.length,
          openOrders,
          results: Array.isArray(results) ? results.length : 0,
          cartItemCount: cartItems.length,
          suggestedCartItems,
          suggestedCount: suggestedCartItems.length,
          mine,
          suggestedCartTotal: suggestedTotal,
          pendingPatientOrders,
        })
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
    setCancelMsg('Checkout was canceled. You can try Pay again when you are ready.')
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev)
        n.delete('cancel')
        return n
      },
      { replace: true },
    )
  }, [cancelFlag, setSearchParams])

  const pay = async (orderId) => {
    try {
      setPayError(null)
      setPayingOrderId(orderId)
      const origin = window.location.origin
      const successUrl = `${origin}/orders/${orderId}?paid=1`
      const cancelUrl = `${origin}/patient?cancel=1`
      await startCheckout(orderId, successUrl, cancelUrl)
    } catch (e) {
      setPayError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setPayingOrderId(null)
    }
  }

  const recActionCount = useMemo(() => {
    if (!data) return 0
    return data.pendingPatientOrders.length + data.suggestedCount
  }, [data])

  const kpis = useMemo(() => {
    if (!data) return []
    return [
      {
        title: 'Cart',
        value: loading ? '—' : data.cartItemCount,
        subtitle: `${data.suggestedCount} suggested · ${data.mine} added by you`,
        icon: ShoppingCart,
        colorKey: 'primary',
      },
      {
        title: 'My orders',
        value: loading ? '—' : data.orders,
        subtitle: `${data.openOrders} awaiting payment or in progress`,
        icon: ClipboardList,
        colorKey: 'primary',
      },
      {
        title: 'Test results',
        value: loading ? '—' : data.results,
        subtitle: 'Lab reports available',
        icon: FlaskConical,
        colorKey: 'secondary',
      },
      {
        title: 'From practitioner',
        value: loading ? '—' : recActionCount,
        subtitle:
          data.pendingPatientOrders.length > 0 || data.suggestedCount > 0
            ? `${data.pendingPatientOrders.length} to pay · ${data.suggestedCount} in cart`
            : 'No pending suggestions',
        icon: Sparkles,
        colorKey: 'primary',
      },
      {
        title: 'Profile',
        value: '—',
        subtitle: 'Account & contact (quick links)',
        icon: UserRound,
        colorKey: 'secondary',
      },
    ]
  }, [data, loading, recActionCount])

  const suggestedPreview = useMemo(() => {
    const items = data?.suggestedCartItems ?? []
    return items.slice(0, 6)
  }, [data?.suggestedCartItems])
  const suggestedOverflow = (data?.suggestedCount ?? 0) - suggestedPreview.length

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Patient dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your orders, lab results, and what your practitioner suggested — including quick ways to pay.
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

      {!loading && data ? (
        <Card className="overflow-hidden border-primary/20 shadow-md">
          <CardHeader className="border-b border-border/60 bg-muted/30 pb-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Stethoscope className="size-5 text-primary" />
                  <CardTitle className="text-lg">From your practitioner</CardTitle>
                </div>
                <CardDescription className="text-base leading-relaxed">
                  Practitioner-added lines in your cart (not checked out yet) and practitioner-placed orders awaiting
                  payment — same info you see in the cart drawer.
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" className="shrink-0" asChild>
                <Link to="/patient/recommendations">Full recommendations page</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-8 pt-6 lg:grid-cols-2">
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Suggested in your cart</h2>
              {!data.suggestedCount ? (
                <p className="text-sm text-muted-foreground">
                  Nothing suggested in your cart right now. When a practitioner adds items, they appear here; you can also
                  shop the catalog yourself.
                </p>
              ) : (
                <>
                  <ul className="space-y-2 text-sm">
                    {suggestedPreview.map((it) => (
                      <li
                        key={it.id}
                        className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-card px-3 py-2"
                      >
                        <span className="min-w-0 font-medium leading-snug">{it.product?.name ?? 'Product'}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          ×{it.quantity} · ${patientLineTotal(it).toFixed(2)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {suggestedOverflow > 0 ? (
                    <p className="text-xs text-muted-foreground">+{suggestedOverflow} more in your cart</p>
                  ) : null}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
                    <span className="text-sm font-semibold tabular-nums">
                      Cart subtotal (suggested){' '}
                      <span className="text-primary">${data.suggestedCartTotal.toFixed(2)}</span>
                    </span>
                    <Link
                      to="/patient/cart?focus=recommendations"
                      className={cn(buttonVariants({ size: 'sm' }), 'inline-flex no-underline')}
                    >
                      Open cart &amp; pay
                    </Link>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Opens the cart with practitioner suggestions in view. Checkout always uses your full cart; the summary
                    checkbox there is for including unpaid suggested orders in the combined total.
                  </p>
                </>
              )}
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Orders awaiting your payment</h2>
              {!data.pendingPatientOrders.length ? (
                <p className="text-sm text-muted-foreground">
                  No unpaid orders right now. When your practitioner places an order for you, it will show here with{' '}
                  <strong className="font-medium text-foreground">Pay now</strong>.
                </p>
              ) : (
                <>
                  <ul className="space-y-2">
                    {data.pendingPatientOrders.map((o) => (
                      <li
                        key={o.id}
                        className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <Link
                            to={`/orders/${o.id}`}
                            className="font-medium text-primary underline-offset-4 hover:underline"
                          >
                            Order #{o.id}
                          </Link>
                          <p className="text-sm text-muted-foreground tabular-nums">
                            Due: ${Number(o.total_patient ?? 0).toFixed(2)}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Link
                            to={`/orders/${o.id}`}
                            className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'inline-flex no-underline')}
                          >
                            Details
                          </Link>
                          <Button
                            type="button"
                            size="sm"
                            className="gap-2"
                            disabled={payingOrderId != null}
                            onClick={() => pay(o.id)}
                          >
                            {payingOrderId === o.id ? (
                              <>
                                <Loader2 className="size-4 animate-spin" />
                                Opening…
                              </>
                            ) : (
                              'Pay now'
                            )}
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          </CardContent>
        </Card>
      ) : loading ? (
        <Skeleton className="h-[280px] w-full rounded-xl" />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.title}>
            {loading && !data ? <Skeleton className="h-[132px] rounded-xl" /> : <KpiCard {...k} />}
          </div>
        ))}
      </div>

      {!loading && data ? (
        <Card className="border-primary/25 bg-gradient-to-br from-primary/5 to-transparent shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Your shared cart</CardTitle>
            <p className="text-sm text-muted-foreground">
              {data.cartItemCount} item{data.cartItemCount === 1 ? '' : 's'} · {data.suggestedCount} from practitioner ·{' '}
              {data.mine} from you
            </p>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link to="/patient/cart" className={cn(buttonVariants({ size: 'sm' }))}>
              Open cart
            </Link>
            <Link to="/patient/catalog/lab-test" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
              Browse catalog
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-border/80 shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Quick links</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link to="/patient/cart" className={cn(buttonVariants({ size: 'sm' }))}>
            Cart
          </Link>
          <Link to="/patient/catalog/lab-test" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
            Catalog
          </Link>
          <Link to="/patient/recommendations" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
            Recommendations
          </Link>
          <Link to="/patient/orders" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
            Orders
          </Link>
          <Link to="/patient/test-results" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
            Test results
          </Link>
          <Link to="/patient/profile" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
            Profile
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
