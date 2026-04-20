import { useEffect, useMemo, useState } from 'react'
import { Building2, Package } from 'lucide-react'
import { addCartItem, clearCart, getPractitionerPatients } from '../../api/client'
import { notifyPractitionerCartChanged, PRACTITIONER_PATIENT_USER_KEY } from '../../context/PractitionerCartContext.jsx'
import VendorCartConflictDialog from './VendorCartConflictDialog.jsx'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

function money(n) {
  const x = Number(n)
  if (Number.isNaN(x)) return '0.00'
  return x.toFixed(2)
}

export default function AddToCartDialog({ open, onOpenChange, product }) {
  const [quantity, setQuantity] = useState(1)
  const [target, setTarget] = useState('self')
  const [patientUserId, setPatientUserId] = useState('')
  const [patients, setPatients] = useState([])
  const [loadingPatients, setLoadingPatients] = useState(false)
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
    setTarget('self')
    const hint =
      typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(PRACTITIONER_PATIENT_USER_KEY) || '' : ''
    if (hint) {
      setTarget('patient')
      setPatientUserId(String(hint))
    } else {
      setPatientUserId('')
    }
  }, [open, product])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    ;(async () => {
      try {
        setLoadingPatients(true)
        const list = await getPractitionerPatients()
        if (!cancelled) setPatients(Array.isArray(list) ? list : [])
      } catch {
        if (!cancelled) setPatients([])
      } finally {
        if (!cancelled) setLoadingPatients(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  const pp = Number(product?.patient_price ?? product?.price ?? 0)
  const pr = Number(product?.practitioner_price ?? product?.price ?? 0)
  const qty = Math.max(1, Number(quantity) || 1)

  const preview = useMemo(() => {
    if (!product) return null
    if (target === 'self') {
      return {
        label: 'Your checkout total (practitioner pricing)',
        subtotal: pr * qty,
        commission: 0,
        commissionLabel: 'Commission on this line',
      }
    }
    const commission = Math.max(0, pp - pr) * qty
    return {
      label: 'Patient pays (at checkout)',
      subtotal: pp * qty,
      commission,
      commissionLabel: 'Est. commission when patient pays this order',
    }
  }, [product, target, pp, pr, qty])

  const vendorName =
    product?.vendorName ?? (product?.vendorId != null ? `Vendor #${product.vendorId}` : '—')

  const buildPayload = () => {
    const payload = { productId: product.id, quantity: qty }
    if (target === 'patient') {
      if (!patientUserId) throw new Error('Select a patient')
      payload.forPatientUserId = Number(patientUserId)
    }
    return payload
  }

  const save = async () => {
    if (!product) return
    try {
      setError(null)
      setSaving(true)
      const payload = buildPayload()
      await addCartItem(payload)
      notifyPractitionerCartChanged()
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
      await clearCart(
        pendingPayload.forPatientUserId != null
          ? { forPatientUserId: pendingPayload.forPatientUserId }
          : {},
      )
      notifyPractitionerCartChanged()
      await addCartItem(pendingPayload)
      notifyPractitionerCartChanged()
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
            <DialogTitle>Add to cart</DialogTitle>
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
              <Label htmlFor="add-qty">Quantity</Label>
              <Input
                id="add-qty"
                type="number"
                min={1}
                step={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>

            <div className="space-y-2">
              <Label>Who is this for?</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setTarget('self')}
                  className={cn(
                    'rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors',
                    target === 'self'
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border bg-card hover:bg-muted/50',
                  )}
                >
                  Myself
                  <span className="mt-1 block text-xs font-normal text-muted-foreground">Practitioner pricing</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTarget('patient')}
                  className={cn(
                    'rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors',
                    target === 'patient'
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border bg-card hover:bg-muted/50',
                  )}
                >
                  A patient
                  <span className="mt-1 block text-xs font-normal text-muted-foreground">Patient pricing · shared cart</span>
                </button>
              </div>
            </div>

            {target === 'patient' ? (
              <div className="space-y-2">
                <Label>Patient</Label>
                <Select
                  value={patientUserId || undefined}
                  onValueChange={(v) => setPatientUserId(v)}
                  disabled={loadingPatients}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingPatients ? 'Loading…' : 'Choose a patient'} />
                  </SelectTrigger>
                  <SelectContent>
                    {patients.map((p) => (
                      <SelectItem key={p.userId} value={String(p.userId)}>
                        {p.name} · {p.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {preview ? (
              <div className="rounded-xl border border-border/80 bg-muted/40 px-4 py-3 text-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{preview.label}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">${money(preview.subtotal)}</p>
                <div className="mt-2 flex items-center justify-between gap-2 border-t border-border/60 pt-2">
                  <span className="text-xs text-muted-foreground">{preview.commissionLabel}</span>
                  <span className="text-sm font-semibold tabular-nums text-primary">${money(preview.commission)}</span>
                </div>
              </div>
            ) : null}

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
            <Button
              type="button"
              onClick={save}
              disabled={saving || (target === 'patient' && !patientUserId)}
            >
              {saving ? 'Saving…' : 'Save to cart'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
