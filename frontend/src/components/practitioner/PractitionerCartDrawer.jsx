import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShoppingCart, User, Users } from 'lucide-react'
import { checkoutCart, removeCartItem, updateCartItem } from '../../api/client'
import { notifyPractitionerCartChanged, usePractitionerCart } from '../../context/PractitionerCartContext.jsx'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'

function lineTotalPatient(it) {
  const p = it.product
  const q = Number(it.quantity) || 0
  return Number(p?.patient_price ?? p?.price ?? 0) * q
}

function lineTotalPractitioner(it) {
  const p = it.product
  const q = Number(it.quantity) || 0
  return Number(p?.practitioner_price ?? p?.price ?? 0) * q
}

export default function PractitionerCartDrawer() {
  const navigate = useNavigate()
  const { drawerOpen, setDrawerOpen, summary, refresh, selfQty, forPatientsQty, totalQty } = usePractitionerCart()
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState(null)

  useEffect(() => {
    if (drawerOpen) {
      refresh()
      setCheckoutError(null)
    }
  }, [drawerOpen, refresh])

  const setQty = async (itemId, quantity) => {
    try {
      await updateCartItem(itemId, quantity)
      notifyPractitionerCartChanged()
    } catch (e) {
      setCheckoutError(e)
    }
  }

  const remove = async (itemId) => {
    try {
      await removeCartItem(itemId)
      notifyPractitionerCartChanged()
    } catch (e) {
      setCheckoutError(e)
    }
  }

  const placeAllOrders = async () => {
    if (!summary) return
    setCheckoutLoading(true)
    setCheckoutError(null)
    const created = []
    try {
      const selfCart = summary.self?.cart
      if (selfCart?.items?.length) {
        const r = await checkoutCart({ scope: 'self' })
        created.push({ label: 'Your order', result: r })
      }
      for (const block of summary.patients || []) {
        if (!block.cart?.items?.length) continue
        const r = await checkoutCart({
          scope: 'patient',
          patientUserId: block.patientUserId,
        })
        created.push({ label: `Order for ${block.patientName}`, result: r })
      }
      notifyPractitionerCartChanged()
      setDrawerOpen(false)
      const firstId = created
        .map((c) => c.result?.order?.id)
        .find((id) => id != null)
      if (firstId) navigate(`/orders/${firstId}`)
      else navigate('/practitioner/orders')
    } catch (e) {
      setCheckoutError(e)
    } finally {
      setCheckoutLoading(false)
    }
  }

  const self = summary?.self
  const patients = summary?.patients || []

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
            <SheetTitle>Cart</SheetTitle>
          </div>
          <SheetDescription className="text-left">
            <span className="inline-flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="tabular-nums">
                You · {selfQty} items
              </Badge>
              <Badge variant="outline" className="tabular-nums">
                Patients · {forPatientsQty} items
              </Badge>
              {totalQty > 0 ? (
                <span className="text-muted-foreground">
                  {totalQty} total line units
                </span>
              ) : null}
            </span>
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1 px-4">
          <div className="space-y-8 py-4">
            {checkoutError ? (
              <Alert variant="destructive">
                <AlertTitle>Checkout</AlertTitle>
                <AlertDescription>{checkoutError.message}</AlertDescription>
              </Alert>
            ) : null}

            <section className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <User className="size-4 text-muted-foreground" />
                For you
              </div>
              {!self?.cart?.items?.length ? (
                <p className="text-sm text-muted-foreground">No items in your practitioner cart.</p>
              ) : (
                <ul className="space-y-3">
                  {self.cart.items.map((it) => (
                    <li
                      key={it.id}
                      className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm"
                    >
                      <div className="flex justify-between gap-2">
                        <span className="font-medium leading-snug">{it.product?.name}</span>
                        <Button type="button" variant="ghost" size="sm" className="h-7 shrink-0 text-destructive" onClick={() => remove(it.id)}>
                          Remove
                        </Button>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                        Your total ${lineTotalPractitioner(it).toFixed(2)}
                      </p>
                      <label className="mt-2 flex items-center gap-2 text-xs">
                        Qty
                        <input
                          type="number"
                          min={1}
                          className="w-16 rounded border border-input bg-background px-2 py-1"
                          value={it.quantity}
                          onChange={(e) => setQty(it.id, Math.max(1, Number(e.target.value) || 1))}
                        />
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              {self?.practitionerSubtotal > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Subtotal (you pay) ${Number(self.practitionerSubtotal).toFixed(2)}
                </p>
              ) : null}
            </section>

            <Separator />

            <section className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Users className="size-4 text-muted-foreground" />
                For patients
              </div>
              {!patients.some((p) => p.cart?.items?.length) ? (
                <p className="text-sm text-muted-foreground">No patient carts with items.</p>
              ) : (
                patients.map((block) =>
                  !block.cart?.items?.length ? null : (
                    <div key={block.patientUserId} className="space-y-2 rounded-xl border border-border/70 bg-card p-3">
                      <div>
                        <p className="font-medium">{block.patientName}</p>
                        <p className="text-xs text-muted-foreground">{block.patientEmail}</p>
                        <p className="mt-1 text-xs text-primary">
                          Est. commission ${Number(block.estimatedCommission || 0).toFixed(2)}
                        </p>
                      </div>
                      <ul className="space-y-2">
                        {block.cart.items.map((it) => (
                          <li key={it.id} className="rounded-md bg-muted/30 p-2 text-sm">
                            <div className="flex justify-between gap-2">
                              <span className="leading-snug">{it.product?.name}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 shrink-0 text-destructive"
                                onClick={() => remove(it.id)}
                              >
                                Remove
                              </Button>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                              Patient pays ${lineTotalPatient(it).toFixed(2)}
                            </p>
                            <label className="mt-2 flex items-center gap-2 text-xs">
                              Qty
                              <input
                                type="number"
                                min={1}
                                className="w-16 rounded border border-input bg-background px-2 py-1"
                                value={it.quantity}
                                onChange={(e) => setQty(it.id, Math.max(1, Number(e.target.value) || 1))}
                              />
                            </label>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ),
                )
              )}
            </section>
          </div>
        </ScrollArea>

        <div className="shrink-0 border-t border-border bg-card px-4 py-4">
          <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
            <strong>Place orders</strong> creates one order for your cart, then one order per patient cart (only non-empty
            carts). You can pay or route patients to pay from their portal as usual.
          </p>
          <Button
            type="button"
            className="w-full"
            disabled={checkoutLoading || totalQty === 0}
            onClick={placeAllOrders}
          >
            {checkoutLoading ? 'Placing orders…' : 'Place all orders'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
