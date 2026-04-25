import { useEffect, useMemo, useRef, useState } from 'react'
import { Building2, ChevronLeft, Package } from 'lucide-react'
import { addCartItem, clearCart, getPractitionerPatients } from '../../api/client'
import {
  notifyPractitionerCartChanged,
  PRACTITIONER_PATIENT_HINT_KEY,
  PRACTITIONER_PATIENT_USER_KEY,
} from '../../context/PractitionerCartContext.jsx'
import PractitionerCreatePatientDialog from './PractitionerCreatePatientDialog.jsx'
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
import { cn } from '@/lib/utils'
import { parsePositiveWhole } from '@/lib/quantity'

const PATIENT_PAGE_SIZE = 25

function money(n) {
  const x = Number(n)
  if (Number.isNaN(x)) return '0.00'
  return x.toFixed(2)
}

function persistPatientChoice(p) {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.setItem(PRACTITIONER_PATIENT_USER_KEY, String(p.userId))
  try {
    sessionStorage.setItem(
      PRACTITIONER_PATIENT_HINT_KEY,
      JSON.stringify({ userId: p.userId, name: p.name ?? '', email: p.email ?? '' }),
    )
  } catch {
    /* ignore */
  }
}

export default function AddToCartDialog({ open, onOpenChange, product }) {
  const [quantity, setQuantity] = useState(1)
  const [target, setTarget] = useState('self')
  const [patientUserId, setPatientUserId] = useState('')
  const [selectedPatientMeta, setSelectedPatientMeta] = useState(null)
  const [patientPickerOpen, setPatientPickerOpen] = useState(false)

  const [pickerSearch, setPickerSearch] = useState('')
  const [debouncedPickerSearch, setDebouncedPickerSearch] = useState('')
  const [pickerPage, setPickerPage] = useState(1)
  const [pickerPatients, setPickerPatients] = useState([])
  const [pickerTotal, setPickerTotal] = useState(0)
  const [loadingPicker, setLoadingPicker] = useState(false)
  const pickerSearchInputRef = useRef(null)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const [conflictOpen, setConflictOpen] = useState(false)
  const [conflictDetails, setConflictDetails] = useState(null)
  const [pendingPayload, setPendingPayload] = useState(null)
  const [conflictLoading, setConflictLoading] = useState(false)
  const [createPatientOpen, setCreatePatientOpen] = useState(false)

  useEffect(() => {
    if (!open || !product) return
    setQuantity(1)
    setError(null)
    setTarget('self')
    setPatientPickerOpen(false)
    setPickerSearch('')
    setDebouncedPickerSearch('')
    setPickerPage(1)
    const uid =
      typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(PRACTITIONER_PATIENT_USER_KEY) || '' : ''
    let hintMeta = null
    if (typeof sessionStorage !== 'undefined' && uid) {
      try {
        const raw = sessionStorage.getItem(PRACTITIONER_PATIENT_HINT_KEY)
        if (raw) {
          const h = JSON.parse(raw)
          if (h && h.userId != null && String(h.userId) === String(uid)) {
            hintMeta = {
              userId: h.userId,
              name: typeof h.name === 'string' && h.name.trim() ? h.name.trim() : 'Patient',
              email: typeof h.email === 'string' ? h.email.trim() : '',
            }
          }
        }
      } catch {
        /* ignore */
      }
    }
    if (uid) {
      setTarget('patient')
      setPatientUserId(String(uid))
      setSelectedPatientMeta(hintMeta)
    } else {
      setPatientUserId('')
      setSelectedPatientMeta(null)
    }
  }, [open, product])

  useEffect(() => {
    const trimmed = pickerSearch.trim()
    const words = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0
    const delay = words >= 2 ? 380 : 620
    const t = setTimeout(() => setDebouncedPickerSearch(trimmed), delay)
    return () => clearTimeout(t)
  }, [pickerSearch])

  useEffect(() => {
    setPickerPage(1)
  }, [debouncedPickerSearch])

  useEffect(() => {
    if (!open || !patientPickerOpen || target !== 'patient') return
    let cancelled = false
    ;(async () => {
      try {
        setLoadingPicker(true)
        const res = await getPractitionerPatients({
          q: debouncedPickerSearch || undefined,
          page: pickerPage,
          limit: PATIENT_PAGE_SIZE,
        })
        if (!cancelled) {
          setPickerPatients(Array.isArray(res?.items) ? res.items : [])
          setPickerTotal(Number(res?.total) || 0)
        }
      } catch {
        if (!cancelled) {
          setPickerPatients([])
          setPickerTotal(0)
        }
      } finally {
        if (!cancelled) setLoadingPicker(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, patientPickerOpen, target, debouncedPickerSearch, pickerPage])

  const pp = Number(product?.patient_price ?? product?.price ?? 0)
  const pr = Number(product?.practitioner_price ?? product?.price ?? 0)
  const qty = Math.max(1, parsePositiveWhole(String(quantity)) ?? 1)

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

  const openPatientPicker = () => {
    setPatientPickerOpen(true)
    setPickerPage(1)
    setPickerSearch('')
    setDebouncedPickerSearch('')
    queueMicrotask(() => pickerSearchInputRef.current?.focus())
  }

  const flushPickerSearchToServer = () => {
    setDebouncedPickerSearch(pickerSearch.trim())
    setPickerPage(1)
  }

  const selectPatientAndClosePicker = (p) => {
    const row = {
      userId: p.userId,
      name: p.name || 'Patient',
      email: p.email || '',
    }
    setPatientUserId(String(row.userId))
    setSelectedPatientMeta(row)
    persistPatientChoice(row)
    setPatientPickerOpen(false)
  }

  const onNewPatientCreated = (row) => {
    selectPatientAndClosePicker({
      userId: row.userId,
      name: row.name,
      email: row.email,
    })
    setPickerPage(1)
    setDebouncedPickerSearch('')
    setPickerSearch('')
  }

  const pickerTotalPages = Math.max(1, Math.ceil(pickerTotal / PATIENT_PAGE_SIZE))
  const pickerRangeStart = pickerTotal === 0 ? 0 : (pickerPage - 1) * PATIENT_PAGE_SIZE + 1
  const pickerRangeEnd = Math.min(pickerTotal, pickerPage * PATIENT_PAGE_SIZE)

  if (!product) return null

  return (
    <>
      <PractitionerCreatePatientDialog
        open={createPatientOpen}
        onOpenChange={setCreatePatientOpen}
        onCreated={onNewPatientCreated}
        title="Add a patient"
        description="Creates a login linked to your practice so you can order on their behalf."
      />
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
          <DialogHeader className="flex-row flex-wrap items-center gap-2 space-y-0 sm:flex-row">
            {patientPickerOpen ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0"
                  onClick={() => setPatientPickerOpen(false)}
                  aria-label="Back to add to cart"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <DialogTitle className="flex-1 text-left">Select patient</DialogTitle>
              </>
            ) : (
              <DialogTitle>Add to cart</DialogTitle>
            )}
          </DialogHeader>

          {patientPickerOpen ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="picker-patient-search">Search</Label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    ref={pickerSearchInputRef}
                    id="picker-patient-search"
                    className="flex-1"
                    placeholder="Name or email…"
                    value={pickerSearch}
                    onChange={(e) => setPickerSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        flushPickerSearchToServer()
                      }
                    }}
                    aria-busy={loadingPicker}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    disabled={!pickerSearch.trim() && !debouncedPickerSearch}
                    onClick={() => {
                      setPickerSearch('')
                      setDebouncedPickerSearch('')
                      setPickerPage(1)
                    }}
                  >
                    Clear
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label id="picker-list-label">Patients</Label>
                <div
                  role="listbox"
                  aria-labelledby="picker-list-label"
                  aria-busy={loadingPicker}
                  className="max-h-[min(50vh,20rem)] overflow-x-hidden overflow-y-auto rounded-lg border border-border bg-card"
                >
                  {loadingPicker && pickerPatients.length === 0 ? (
                    <div className="px-3 py-8 text-center text-sm text-muted-foreground">Loading…</div>
                  ) : null}
                  {!loadingPicker && pickerPatients.length === 0 ? (
                    <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                      No patients match this search.
                    </div>
                  ) : null}
                  {pickerPatients.map((p) => {
                    const val = String(p.userId)
                    const selected = patientUserId === val
                    return (
                      <button
                        key={val}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        disabled={loadingPicker}
                        onClick={() => selectPatientAndClosePicker(p)}
                        className={cn(
                          'flex w-full flex-col items-start gap-0.5 border-b border-border px-3 py-2.5 text-left text-sm last:border-b-0',
                          'transition-colors hover:bg-muted/60',
                          selected ? 'bg-primary/10 font-medium' : 'bg-transparent',
                        )}
                      >
                        <span className="leading-snug">{p.name || 'Patient'}</span>
                        {p.email ? (
                          <span className="max-w-full truncate text-xs font-normal text-muted-foreground">
                            {p.email}
                          </span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="tabular-nums">
                  {pickerTotal === 0
                    ? '0 patients'
                    : `${pickerRangeStart}–${pickerRangeEnd} of ${pickerTotal}`}
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    disabled={loadingPicker || pickerPage <= 1}
                    onClick={() => setPickerPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    disabled={loadingPicker || pickerPage >= pickerTotalPages}
                    onClick={() => setPickerPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Page <span className="tabular-nums">{pickerPage}</span> of{' '}
                <span className="tabular-nums">{pickerTotalPages}</span>
              </p>

              <p className="text-center text-sm text-muted-foreground">
                Need someone new?{' '}
                <button
                  type="button"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                  onClick={() => setCreatePatientOpen(true)}
                >
                  Add a patient
                </button>
              </p>
            </div>
          ) : (
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
                  inputMode="numeric"
                  value={quantity}
                  onChange={(e) => {
                    const w = parsePositiveWhole(e.target.value)
                    if (w != null) setQuantity(w)
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label>Who is this for?</Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTarget('self')
                      setPatientPickerOpen(false)
                    }}
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
                    onClick={() => {
                      setTarget('patient')
                      setPatientPickerOpen(false)
                    }}
                    className={cn(
                      'rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors',
                      target === 'patient'
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border bg-card hover:bg-muted/50',
                    )}
                  >
                    A patient
                    <span className="mt-1 block text-xs font-normal text-muted-foreground">
                      Patient pricing · shared cart
                    </span>
                  </button>
                </div>
              </div>

              {target === 'patient' ? (
                <div className="space-y-2">
                  <Label>Patient</Label>
                  <div className="rounded-lg border border-border bg-muted/30 px-3 py-3">
                    {selectedPatientMeta ? (
                      <div className="min-w-0 space-y-0.5">
                        <p className="truncate font-medium">{selectedPatientMeta.name}</p>
                        {selectedPatientMeta.email ? (
                          <p className="truncate text-xs text-muted-foreground">{selectedPatientMeta.email}</p>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No patient selected.</p>
                    )}
                  </div>
                  <Button type="button" variant="secondary" className="w-full" onClick={openPatientPicker}>
                    {patientUserId ? 'Change patient' : 'Select patient'}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    Don&apos;t see them?{' '}
                    <button
                      type="button"
                      className="font-medium text-primary underline-offset-4 hover:underline"
                      onClick={() => setCreatePatientOpen(true)}
                    >
                      Add a patient
                    </button>
                  </p>
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
          )}

          {!patientPickerOpen ? (
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
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
