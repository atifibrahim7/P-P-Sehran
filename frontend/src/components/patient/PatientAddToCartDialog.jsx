import { useEffect, useMemo, useState } from 'react'
import { Building2, Package } from 'lucide-react'
import { addCartItem, clearCart } from '../../api/client'
import { notifyPatientCartChanged } from '../../context/PatientCartContext.jsx'
import VendorCartConflictDialog from '../practitioner/VendorCartConflictDialog.jsx'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { parsePositiveWhole } from '@/lib/quantity'

function money(n) {
  const x = Number(n)
  if (Number.isNaN(x)) return '0.00'
  return x.toFixed(2)
}

export default function PatientAddToCartDialog({ open, onOpenChange, product }) {
  const [quantity, setQuantity] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const [conflictOpen, setConflictOpen] = useState(false)
  const [conflictDetails, setConflictDetails] = useState(null)
  const [pendingPayload, setPendingPayload] = useState(null)
  const [conflictLoading, setConflictLoading] = useState(false)

  useEffect(() => {
    if (!open || !product) return
    setQuantity(1)
    setError(null)
  }, [open, product])

  const pp = Number(product?.patient_price ?? product?.price ?? 0)
  const qty = Math.max(1, parsePositiveWhole(String(quantity)) ?? 1)

  const preview = useMemo(
    () => ({
      label: 'Your price (at checkout)',
      subtotal: pp * qty,
    }),
    [pp, qty],
  )

  const vendorName =
    product?.vendorName ?? (product?.vendorId != null ? `Vendor #${product.vendorId}` : '—')

  const buildPayload = () => ({
    productId: product.id,
    quantity: qty,
  })

  const save = async () => {
    if (!product) return
    try {
      setError(null)
      setSaving(true)
      const payload = buildPayload()
      await addCartItem(payload)
      notifyPatientCartChanged()
      onOpenChange(false)
    } catch (e) {
      if (e.status === 409 && e.code === 'VENDOR_CONFLICT') {
        try {
          const payload = buildPayload()
          setConflictDetails(e.details)
          setPendingPayload(payload)
          setConflictOpen(true)
        } catch (err) {
          setError(err)
        } finally {
          setSaving(false)
        }
        return
      }
      setError(e)
    } finally {
      setSaving(false)
    }
  }

  const handleConflictProceed = async () => {
    if (!pendingPayload || !product) return
    try {
      setConflictLoading(true)
      setError(null)
      await clearCart({})
      notifyPatientCartChanged()
      await addCartItem(pendingPayload)
      notifyPatientCartChanged()
      setConflictOpen(false)
      setConflictDetails(null)
      setPendingPayload(null)
      onOpenChange(false)
    } catch (e) {
      setError(e)
    } finally {
      setConflictLoading(false)
    }
  }

  if (!product) return null

  return (
    <>
      <VendorCartConflictDialog
        open={conflictOpen}
        onOpenChange={setConflictOpen}
        details={conflictDetails}
        loading={conflictLoading}
        onCancel={() => {
          setConflictOpen(false)
          setPendingPayload(null)
          setConflictDetails(null)
        }}
        onProceed={handleConflictProceed}
      />
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" showCloseButton>
          <DialogHeader>
            <DialogTitle>Add to your cart</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-muted">
                {product.imageLink ? (
                  <img src={product.imageLink} alt="" className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center text-muted-foreground">
                    <Package className="size-8 opacity-40" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-semibold leading-snug">{product.name}</p>
                {product.description ? (
                  <p className="line-clamp-3 text-xs text-muted-foreground">{product.description}</p>
                ) : null}
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Building2 className="size-3.5 shrink-0" />
                  <span className="truncate">{vendorName}</span>
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="patient-add-qty">Quantity</Label>
              <Input
                id="patient-add-qty"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={quantity}
                onChange={(e) => {
                  const w = parsePositiveWhole(e.target.value)
                  if (w != null) setQuantity(w)
                }}
              />
            </div>

            <p className="text-xs leading-relaxed text-muted-foreground">
              Items go into your cart for checkout at patient prices. If you have a linked practitioner, you may also see
              items they suggest in the same cart.
            </p>

            <div className="rounded-xl border border-border/80 bg-muted/40 px-4 py-3 text-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{preview.label}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">${money(preview.subtotal)}</p>
            </div>

            {error ? (
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error.message}</AlertDescription>
              </Alert>
            ) : null}
          </div>

          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Add to cart'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
