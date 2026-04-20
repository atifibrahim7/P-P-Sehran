import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2, ShoppingCart, Stethoscope } from 'lucide-react'
import { checkoutCart, getOrders, removeCartItem, startCheckout, updateCartItem } from '../../api/client'
import { notifyPatientCartChanged, usePatientCart } from '../../context/PatientCartContext.jsx'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

const FOCUS_SESSION_KEY = 'pp_cart_scroll_recommendations'

function lineTotalPatient(it) {
  const p = it.product
  const q = Number(it.quantity) || 0
  return Number(p?.patient_price ?? p?.price ?? 0) * q
}

export default function PatientCartDrawer() {
  const navigate = useNavigate()
  const { drawerOpen, setDrawerOpen, cart, cartMessage, refresh, totalQty } = usePatientCart()
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState(null)
  const [includePendingInSummary, setIncludePendingInSummary] = useState(false)
  const [pendingOrders, setPendingOrders] = useState([])
  const [pendingOrdersLoading, setPendingOrdersLoading] = useState(false)
  const [payingOrderId, setPayingOrderId] = useState(null)
  const [payError, setPayError] = useState(null)
  const pendingSectionRef = useRef(null)

  useEffect(() => {
    if (!drawerOpen) return
    refresh()
    setCheckoutError(null)
    setPayError(null)
    setIncludePendingInSummary(false)
    let cancelled = false
    setPendingOrdersLoading(true)
    ;(async () => {
      try {
        const list = await getOrders()
        if (cancelled) return
        const arr = Array.isArray(list) ? list : []
        setPendingOrders(arr.filter((o) => o.type === 'patient' && o.state === 'pending'))
      } catch {
        if (!cancelled) setPendingOrders([])
      } finally {
        if (!cancelled) setPendingOrdersLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [drawerOpen, refresh])

  useEffect(() => {
    if (!drawerOpen) return
    let ignore = false
    try {
      if (sessionStorage.getItem(FOCUS_SESSION_KEY) === '1') {
        sessionStorage.removeItem(FOCUS_SESSION_KEY)
        const id = requestAnimationFrame(() => {
          if (ignore) return
          pendingSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })
        return () => {
          ignore = true
          cancelAnimationFrame(id)
        }
      }
    } catch {
      /* ignore */
    }
    return undefined
  }, [drawerOpen])

  const items = cart?.items || []
  const cartTotal = useMemo(
    () => items.reduce((acc, it) => acc + lineTotalPatient(it), 0),
    [items],
  )
  const pendingTotal = useMemo(
    () => pendingOrders.reduce((acc, o) => acc + Number(o.total_patient ?? 0), 0),
    [pendingOrders],
  )
  const summaryTotal = includePendingInSummary ? cartTotal + pendingTotal : cartTotal

  const setQty = async (itemId, quantity) => {
    try {
      await updateCartItem(itemId, quantity)
      notifyPatientCartChanged()
    } catch (e) {
      setCheckoutError(e)
    }
  }

  const remove = async (itemId) => {
    try {
      await removeCartItem(itemId)
      notifyPatientCartChanged()
    } catch (e) {
      setCheckoutError(e)
    }
  }

  const placeOrder = async () => {
    if (!items.length) return
    setCheckoutLoading(true)
    setCheckoutError(null)
    try {
      const out = await checkoutCart({})
      notifyPatientCartChanged()
      setDrawerOpen(false)
      if (out?.order?.id) navigate(`/orders/${out.order.id}`)
    } catch (e) {
      setCheckoutError(e)
    } finally {
      setCheckoutLoading(false)
    }
  }

  const unavailable = cartMessage != null && cart == null

  const payPendingOrder = async (orderId) => {
    try {
      setPayError(null)
      setPayingOrderId(orderId)
      const origin = window.location.origin
      const successUrl = `${origin}/orders/${orderId}?paid=1`
      const cancelUrl = `${origin}/patient/catalog/lab-test?cancel=1`
      await startCheckout(orderId, successUrl, cancelUrl)
    } catch (e) {
      setPayError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setPayingOrderId(null)
    }
  }

  return (
    <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
      <SheetContent
        side="right"
        className="flex h-full max-h-[100dvh] w-full min-h-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
        showCloseButton
      >
        <SheetHeader className="shrink-0 border-b border-border px-4 py-4 text-left">
          <div className="flex items-center gap-2">
            <ShoppingCart className="size-5 text-primary" />
            <SheetTitle>Your cart</SheetTitle>
          </div>
          <SheetDescription className="text-left">
            <span className="tabular-nums">{totalQty > 0 ? `${totalQty} in cart` : 'empty cart'}</span>
            {pendingOrders.length > 0 ? (
              <span className="text-muted-foreground">
                {' '}
                · {pendingOrders.length} practitioner-suggested order{pendingOrders.length === 1 ? '' : 's'} awaiting
                payment
              </span>
            ) : null}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1 px-4">
          <div className="space-y-8 py-4">
            {unavailable ? (
              <Alert>
                <AlertTitle>Cart unavailable</AlertTitle>
                <AlertDescription>{cartMessage}</AlertDescription>
              </Alert>
            ) : null}

            {checkoutError ? (
              <Alert variant="destructive">
                <AlertTitle>Checkout</AlertTitle>
                <AlertDescription>{checkoutError.message}</AlertDescription>
              </Alert>
            ) : null}
            {payError ? (
              <Alert variant="destructive">
                <AlertTitle>Payment</AlertTitle>
                <AlertDescription>{payError.message}</AlertDescription>
              </Alert>
            ) : null}

            {!unavailable ? (
              <>
                <section ref={pendingSectionRef} className="scroll-mt-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Stethoscope className="size-4 text-muted-foreground" />
                    Suggested by your practitioner (awaiting payment)
                  </div>
                  <p className="text-xs text-muted-foreground">
                    These orders are ready for you to pay — separate from items still in your cart.
                  </p>
                  {pendingOrdersLoading ? (
                    <p className="text-sm text-muted-foreground">Loading…</p>
                  ) : !pendingOrders.length ? (
                    <p className="text-sm text-muted-foreground">None right now.</p>
                  ) : (
                    <ul className="space-y-3">
                      {pendingOrders.map((o) => (
                        <li
                          key={o.id}
                          className="rounded-lg border border-amber-500/25 bg-amber-500/[0.06] p-3 text-sm"
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <Link
                                to={`/orders/${o.id}`}
                                className="font-medium text-primary underline-offset-4 hover:underline"
                              >
                                Order #{o.id}
                              </Link>
                              <p className="text-xs tabular-nums text-muted-foreground">
                                Due: ${Number(o.total_patient ?? 0).toFixed(2)}
                              </p>
                            </div>
                            <div className="flex shrink-0 flex-wrap gap-2">
                              <Link
                                to={`/orders/${o.id}`}
                                className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'inline-flex no-underline')}
                              >
                                Details
                              </Link>
                              <Button
                                type="button"
                                size="sm"
                                className="gap-1.5"
                                disabled={payingOrderId != null}
                                onClick={() => payPendingOrder(o.id)}
                              >
                                {payingOrderId === o.id ? (
                                  <>
                                    <Loader2 className="size-3.5 animate-spin" />
                                    Opening…
                                  </>
                                ) : (
                                  'Pay now'
                                )}
                              </Button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <Separator />

                <section className="space-y-3">
                  <h2 className="text-sm font-semibold">Your cart</h2>
                  {!items.length ? (
                    <p className="text-sm text-muted-foreground">Nothing in your cart yet — browse the catalog to add products.</p>
                  ) : (
                    <ul className="space-y-3">
                      {items.map((it) => (
                        <CartLine key={it.id} it={it} onQty={setQty} onRemove={remove} />
                      ))}
                    </ul>
                  )}
                </section>
              </>
            ) : null}
          </div>
        </ScrollArea>

        <div className="shrink-0 border-t border-border bg-card px-4 py-4">
          {!unavailable && items.length > 0 ? (
            <>
              {pendingOrders.length > 0 ? (
                <div className="mb-3 rounded-lg border border-border/80 bg-background p-3">
                  <Label className="flex cursor-pointer items-start gap-3 text-sm font-normal leading-snug">
                    <input
                      type="checkbox"
                      className="mt-0.5 size-4 shrink-0 rounded border-input accent-primary"
                      checked={includePendingInSummary}
                      onChange={(e) => setIncludePendingInSummary(e.target.checked)}
                    />
                    <span>
                      <span className="font-medium text-foreground">Also include practitioner-suggested orders in summary</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        Adds unpaid practitioner orders ({pendingTotal.toFixed(2)}) to the total below so you see the full
                        amount you may need to resolve. Cart checkout still only covers your cart.
                      </span>
                    </span>
                  </Label>
                </div>
              ) : null}

              <div className="mb-3 space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-muted-foreground">Cart</span>
                  <span className="tabular-nums font-medium">${cartTotal.toFixed(2)}</span>
                </div>
                {includePendingInSummary && pendingOrders.length > 0 ? (
                  <div className="flex items-baseline justify-between gap-2 text-muted-foreground">
                    <span>Suggested orders (unpaid)</span>
                    <span className="tabular-nums">${pendingTotal.toFixed(2)}</span>
                  </div>
                ) : null}
                <div className="flex items-baseline justify-between gap-2 border-t border-border/60 pt-2">
                  <span className="font-medium">{includePendingInSummary ? 'Combined total' : 'Cart checkout'}</span>
                  <span className="text-lg font-semibold tabular-nums text-primary">${summaryTotal.toFixed(2)}</span>
                </div>
              </div>

              <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
                Create order creates one order from your cart only. Pay suggested orders separately with Pay now above.
              </p>
              <Button type="button" className="w-full" disabled={checkoutLoading} onClick={placeOrder}>
                {checkoutLoading ? 'Creating order…' : 'Create order & pay (cart)'}
              </Button>
            </>
          ) : !unavailable ? (
            <div className="space-y-2">
              {pendingOrders.length > 0 ? (
                <p className="text-center text-xs text-muted-foreground">
                  Use Pay now on practitioner-suggested orders above, or add items from the catalog.
                </p>
              ) : null}
              <Button type="button" variant="secondary" className="w-full" onClick={() => setDrawerOpen(false)}>
                Continue shopping
              </Button>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function CartLine({ it, onQty, onRemove }) {
  return (
    <li className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
      <div className="flex justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium leading-snug">{it.product?.name}</span>
            <Badge variant={it.addedBy === 'practitioner' ? 'secondary' : 'default'}>
              {it.addedBy === 'practitioner' ? 'Practitioner' : 'You'}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
            ${Number(it.product?.patient_price ?? it.product?.price ?? 0).toFixed(2)} each · line ${lineTotalPatient(it).toFixed(2)}
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" className="h-7 shrink-0 text-destructive" onClick={() => onRemove(it.id)}>
          Remove
        </Button>
      </div>
      <label className="mt-2 flex items-center gap-2 text-xs">
        Qty
        <input
          type="number"
          min={1}
          className="w-16 rounded border border-input bg-background px-2 py-1"
          value={it.quantity}
          onChange={(e) => onQty(it.id, Math.max(1, Number(e.target.value) || 1))}
        />
      </label>
    </li>
  )
}
