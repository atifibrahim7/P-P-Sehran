import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  checkoutCart,
  getCart,
  getPractitionerPatients,
  removeCartItem,
  updateCartItem,
} from '../../api/client'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'

const PATIENT_KEY = 'pp_selected_patient_user_id'

function initialPatientFromSession() {
  if (typeof sessionStorage === 'undefined') return ''
  return sessionStorage.getItem(PATIENT_KEY) || ''
}

export default function Cart() {
  const navigate = useNavigate()
  const [patients, setPatients] = useState([])
  const [mode, setMode] = useState(() => (initialPatientFromSession() ? 'patient' : 'self'))
  const [patientUserId, setPatientUserId] = useState(() => initialPatientFromSession())
  const [cart, setCart] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)

  const loadCart = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getCart(
        mode === 'patient' && patientUserId
          ? { forPatientUserId: patientUserId }
          : {},
      )
      setCart(data.cart)
    } catch (e) {
      setError(e)
      setCart(null)
    } finally {
      setLoading(false)
    }
  }, [mode, patientUserId])

  useEffect(() => {
    ;(async () => {
      try {
        const list = await getPractitionerPatients()
        setPatients(Array.isArray(list) ? list : [])
      } catch {
        setPatients([])
      }
    })()
  }, [])

  useEffect(() => {
    loadCart()
  }, [loadCart])

  useEffect(() => {
    if (patientUserId) sessionStorage.setItem(PATIENT_KEY, patientUserId)
    else sessionStorage.removeItem(PATIENT_KEY)
  }, [patientUserId])

  const items = cart?.items || []

  const suggested = useMemo(() => items.filter((i) => i.addedBy === 'practitioner'), [items])
  const patientAdded = useMemo(() => items.filter((i) => i.addedBy === 'patient'), [items])

  const totals = useMemo(() => {
    let tp = 0
    let tpr = 0
    for (const it of items) {
      const p = it.product
      const q = it.quantity || 1
      tp += Number(p?.patient_price ?? p?.price ?? 0) * q
      tpr += Number(p?.practitioner_price ?? p?.price ?? 0) * q
    }
    return { totalPatient: tp, totalPractitioner: tpr }
  }, [items])

  const setQty = async (itemId, quantity) => {
    try {
      setError(null)
      const data = await updateCartItem(itemId, quantity)
      setCart(data)
    } catch (e) {
      setError(e)
    }
  }

  const remove = async (itemId) => {
    try {
      setError(null)
      const data = await removeCartItem(itemId)
      setCart(data)
    } catch (e) {
      setError(e)
    }
  }

  const checkoutSelf = async () => {
    try {
      setError(null)
      setMessage(null)
      const out = await checkoutCart({ scope: 'self' })
      await loadCart()
      if (out?.order?.id) navigate(`/orders/${out.order.id}`)
      else setMessage('Self order created. Pay from Orders when ready.')
    } catch (e) {
      setError(e)
    }
  }

  const checkoutForPatient = async () => {
    if (!patientUserId) {
      setError(Object.assign(new Error('Select a patient first'), { status: 400 }))
      return
    }
    try {
      setError(null)
      setMessage(null)
      const out = await checkoutCart({ scope: 'patient', patientUserId: Number(patientUserId) })
      await loadCart()
      if (out?.order?.id) navigate(`/orders/${out.order.id}`)
      else setMessage('Patient order created. They can pay from their portal.')
    } catch (e) {
      setError(e)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Practitioner · Cart</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Order for yourself or build a cart for a patient. Patient carts sync with their dashboard.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : null}
      {message ? (
        <Alert>
          <AlertTitle>Done</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant={mode === 'self' ? 'default' : 'outline'} onClick={() => setMode('self')}>
          My cart
        </Button>
        <Button type="button" size="sm" variant={mode === 'patient' ? 'default' : 'outline'} onClick={() => setMode('patient')}>
          For a patient
        </Button>
      </div>

      {mode === 'patient' ? (
        <Card className="border-border/80 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Select patient</CardTitle>
            <CardDescription>Only patients assigned to you appear here.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="patient">Patient</Label>
            <Select
              value={patientUserId ? String(patientUserId) : undefined}
              onValueChange={(v) => setPatientUserId(v)}
            >
              <SelectTrigger id="patient" className="max-w-md">
                <SelectValue placeholder="Choose a patient…" />
              </SelectTrigger>
              <SelectContent>
                {patients.map((p) => (
                  <SelectItem key={p.userId} value={String(p.userId)} label={p.name}>
                    {p.name} ({p.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!patients.length ? (
              <p className="text-sm text-muted-foreground">No patients yet — assign patients to your practice first.</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-border/80 shadow-none">
        <CardHeader>
          <CardTitle className="text-base">
            {mode === 'self' ? 'My items' : 'Patient cart items'}{' '}
            {loading ? <span className="text-muted-foreground">…</span> : <span className="text-muted-foreground">({items.length})</span>}
          </CardTitle>
          {mode === 'patient' && patientUserId ? (
            <CardDescription>
              Items you add appear as &quot;Suggested&quot; on the patient&apos;s cart. Amounts below are patient prices
              (what they pay). They can add their own items too.
            </CardDescription>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          {mode === 'patient' && !patientUserId ? (
            <p className="text-sm text-muted-foreground">Select a patient to view or edit their cart.</p>
          ) : loading ? (
            <p className="text-sm text-muted-foreground">Loading cart…</p>
          ) : !items.length ? (
            <p className="text-sm text-muted-foreground">Cart is empty. Add products from the catalog.</p>
          ) : mode === 'patient' ? (
            <>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Suggested by you</p>
                <CartItemList billing="patient" items={suggested} onQty={setQty} onRemove={remove} />
                {!suggested.length ? <p className="text-sm text-muted-foreground">None yet.</p> : null}
              </div>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Added by patient</p>
                <CartItemList billing="patient" items={patientAdded} onQty={setQty} onRemove={remove} />
                {!patientAdded.length ? <p className="text-sm text-muted-foreground">Patient has not added items yet.</p> : null}
              </div>
            </>
          ) : (
            <CartItemList billing="practitioner" items={items} onQty={setQty} onRemove={remove} />
          )}

          {items.length > 0 ? (
            <>
              <Separator />
              <p className="text-sm text-muted-foreground">
                {mode === 'patient' && patientUserId
                  ? `Patient checkout total — $${totals.totalPatient.toFixed(2)} (patient prices; they pay this when they order)`
                  : `Your checkout total — $${totals.totalPractitioner.toFixed(2)} (practitioner prices)`}
              </p>
              <div className="flex flex-wrap gap-2">
                {mode === 'self' ? (
                  <Button type="button" onClick={checkoutSelf}>
                    Create order for myself
                  </Button>
                ) : (
                  <Button type="button" disabled={!patientUserId} onClick={checkoutForPatient}>
                    Create order for patient
                  </Button>
                )}
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

function CartItemList({ billing, items, onQty, onRemove }) {
  const isPatientBill = billing === 'patient'
  return (
    <ul className="space-y-3">
      {items.map((it) => (
        <li
          key={it.id}
          className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{it.product?.name}</span>
              <Badge variant="outline" className="text-[10px]">
                {it.addedBy === 'practitioner' ? 'Practitioner' : 'Patient'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {isPatientBill ? 'Patient price' : 'Your price'} — $
              {Number(
                isPatientBill
                  ? it.product?.patient_price ?? it.product?.price ?? 0
                  : it.product?.practitioner_price ?? it.product?.price ?? 0,
              ).toFixed(2)}{' '}
              each
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1 text-sm">
              Qty
              <input
                type="number"
                min={1}
                className="w-16 rounded border border-input bg-background px-2 py-1 text-sm"
                value={it.quantity}
                onChange={(e) => {
                  const q = Math.max(1, Number(e.target.value) || 1)
                  onQty(it.id, q)
                }}
              />
            </label>
            <Button type="button" size="sm" variant="destructive" onClick={() => onRemove(it.id)}>
              Remove
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )
}
