import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, ShoppingCart, Stethoscope } from 'lucide-react'
import {
  checkoutCart,
  getOrders,
  removeCartItem,
  startCheckout,
  startCheckoutOrders,
  updateCartItem,
} from '../../api/client'
import { notifyPatientCartChanged, usePatientCart } from '../../context/PatientCartContext.jsx'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { parsePositiveWhole } from '@/lib/quantity'

const FOCUS_SESSION_KEY = 'pp_cart_scroll_recommendations'

function lineTotalPatient(it) {
  const p = it.product
  const q = Number(it.quantity) || 0
  return Number(p?.patient_price ?? p?.price ?? 0) * q
}

export default function PatientCartDrawer() {
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
    let cancelled = false
    setPendingOrdersLoading(true)
    ;(async () => {
      try {
        const list = await getOrders()
        if (cancelled) return
        const arr = Array.isArray(list) ? list : []
        const pending = arr.filter((o) => o.type === 'patient' && o.state === 'pending')
        setPendingOrders(pending)
        if (!cancelled) setIncludePendingInSummary(pending.length > 0)
      } catch {
        if (!cancelled) {
          setPendingOrders([])
          setIncludePendingInSummary(false)
        }
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
    const w = parsePositiveWhole(String(quantity))
    if (w == null) return
    try {
      await updateCartItem(itemId, w)
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
      const newId = out?.order?.id
      if (!newId) throw new Error('Order was not created')
      const origin = window.location.origin
      const successUrl = `${origin}/orders/${newId}?paid=1`
      const cancelUrl = `${origin}/patient/catalog/lab-test?cancel=1`
      const suggestionIds = pendingOrders.map((o) => o.id)
      if (includePendingInSummary && suggestionIds.length > 0) {
        await startCheckoutOrders([newId, ...suggestionIds], successUrl, cancelUrl)
      } else {
        await startCheckout(newId, successUrl, cancelUrl)
      }
      setDrawerOpen(false)
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
        <SheetHeader className="shrink-0 border-b border-border bg-gradient-to-b from-primary/5 to-transparent px-5 py-4 text-left">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
              <ShoppingCart className="size-4 text-primary" />
            </div>
            <SheetTitle className="text-base">Your cart</SheetTitle>
          </div>
          <SheetDescription className="text-left">
            <span className="tabular-nums text-xs">{totalQty > 0 ? `${totalQty} item${totalQty === 1 ? '' : 's'}` : 'Empty'}</span>
            {pendingOrders.length > 0 ? (
              <span className="text-muted-foreground text-xs">
                {' '}· {pendingOrders.length} awaiting payment
              </span>
            ) : null}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1 px-5">
          <div className="space-y-6 py-5">
            {unavailable ? (
              <Alert>
                <AlertTitle>Cart unavailable</AlertTitle>
                <AlertDescription>{cartMessage}</AlertDescription>
              </Alert>
            ) : null}
            {checkoutError ? (
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{checkoutError.message}</AlertDescription>
              </Alert>
            ) : null}
            {payError ? (
              <Alert variant="destructive">
                <AlertTitle>Payment error</AlertTitle>
                <AlertDescription>{payError.message}</AlertDescription>
              </Alert>
            ) : null}

            {!unavailable ? (
              <>
                <section ref={pendingSectionRef} className="scroll-mt-4 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Stethoscope className="size-3.5" />
                    Awaiting payment
                  </div>
                  {pendingOrdersLoading ? (
                    <p className="text-sm text-muted-foreground">Loading…</p>
                  ) : !pendingOrders.length ? (
                    <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">No pending orders</p>
                  ) : (
                    <ul className="space-y-2">
                      {pendingOrders.map((o) => (
                        <li
                          key={o.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2.5 text-sm"
                        >
                          <div className="min-w-0">
                            <Link
                              to={`/orders/${o.id}`}
                              className="font-medium text-primary underline-offset-4 hover:underline"
                            >
                              Order #{o.id}
                            </Link>
                            <p className="text-xs tabular-nums text-muted-foreground">
                              ${Number(o.total_patient ?? 0).toFixed(2)}
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-1.5">
                            <Link
                              to={`/orders/${o.id}`}
                              className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'inline-flex no-underline h-7 text-xs')}
                            >
                              View
                            </Link>
                            <Button
                              type="button"
                              size="sm"
                              className="h-7 gap-1 text-xs"
                              disabled={payingOrderId != null}
                              onClick={() => payPendingOrder(o.id)}
                            >
                              {payingOrderId === o.id ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : null}
                              Pay
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <Separator />

                <section className="space-y-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your cart</p>
                  {!items.length ? (
                    <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">Nothing in your cart yet</p>
                  ) : (
                    <ul className="space-y-2">
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

        <div className="shrink-0 border-t border-border bg-card px-5 py-4">
          {!unavailable && items.length > 0 ? (
            <div className="space-y-3">
              {pendingOrders.length > 0 ? (
                <Label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm font-normal hover:bg-muted/60 transition-colors">
                  <input
                    type="checkbox"
                    className="size-4 shrink-0 accent-primary"
                    checked={includePendingInSummary}
                    onChange={(e) => setIncludePendingInSummary(e.target.checked)}
                  />
                  <span className="font-medium">Include suggested orders</span>
                  <span className="ml-auto tabular-nums text-muted-foreground">${pendingTotal.toFixed(2)}</span>
                </Label>
              ) : null}

              <div className="space-y-1.5 rounded-xl border border-border/60 bg-muted/20 px-3 py-3 text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-muted-foreground">Cart</span>
                  <span className="tabular-nums font-medium">${cartTotal.toFixed(2)}</span>
                </div>
                {includePendingInSummary && pendingOrders.length > 0 ? (
                  <div className="flex items-baseline justify-between gap-2 text-muted-foreground">
                    <span>Suggested (unpaid)</span>
                    <span className="tabular-nums">${pendingTotal.toFixed(2)}</span>
                  </div>
                ) : null}
                <div className="flex items-baseline justify-between gap-2 border-t border-border/60 pt-1.5">
                  <span className="font-semibold">{includePendingInSummary ? 'Total' : 'Checkout total'}</span>
                  <span className="text-lg font-bold tabular-nums text-primary">${summaryTotal.toFixed(2)}</span>
                </div>
              </div>

              <Button
                type="button"
                className="w-full rounded-xl h-10 font-semibold shadow-sm shadow-primary/20"
                disabled={checkoutLoading}
                onClick={placeOrder}
              >
                {checkoutLoading
                  ? 'Creating order…'
                  : includePendingInSummary && pendingOrders.length > 0
                    ? 'Checkout & pay all'
                    : 'Checkout'}
              </Button>
            </div>
          ) : !unavailable ? (
            <Button type="button" variant="secondary" className="w-full rounded-xl h-10" onClick={() => setDrawerOpen(false)}>
              Continue shopping
            </Button>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function CartLine({ it, onQty, onRemove }) {
  return (
    <li className="rounded-xl border border-border/70 bg-card px-3 py-2.5 text-sm shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium leading-snug">{it.product?.name}</span>
            <Badge
              variant={it.addedBy === 'practitioner' ? 'secondary' : 'default'}
              className="text-[10px] px-1.5 py-0"
            >
              {it.addedBy === 'practitioner' ? 'Practitioner' : 'You'}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
            ${Number(it.product?.patient_price ?? it.product?.price ?? 0).toFixed(2)} × {it.quantity} = ${lineTotalPatient(it).toFixed(2)}
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive" onClick={() => onRemove(it.id)}>
          ×
        </Button>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Qty</span>
        <input
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          className="h-7 w-16 rounded-lg border border-input bg-background px-2 text-xs"
          value={it.quantity}
          onChange={(e) => {
            const w = parsePositiveWhole(e.target.value)
            if (w != null) void onQty(it.id, w)
          }}
        />
      </div>
    </li>
  )
}
