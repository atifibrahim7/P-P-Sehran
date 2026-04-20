import { useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider.jsx'
import { addCartItem, getPractitionerPatients, getProducts } from '../../api/client'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

const PATIENT_KEY = 'pp_selected_patient_user_id'

export default function Catalog() {
  const { user } = useAuth()
  const [products, setProducts] = useState([])
  const [patients, setPatients] = useState([])
  const [patientUserId, setPatientUserId] = useState(() => sessionStorage.getItem(PATIENT_KEY) || '')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    ;(async () => {
      try {
        setLoading(true)
        const [ps, list] = await Promise.all([getProducts(), getPractitionerPatients()])
        setProducts(ps)
        setPatients(Array.isArray(list) ? list : [])
      } catch (e) {
        setError(e)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  useEffect(() => {
    if (patientUserId) sessionStorage.setItem(PATIENT_KEY, patientUserId)
    else sessionStorage.removeItem(PATIENT_KEY)
  }, [patientUserId])

  const addToCart = async (p) => {
    try {
      setError(null)
      setToast(null)
      const body = {
        productId: p.id,
        quantity: 1,
        ...(patientUserId ? { forPatientUserId: Number(patientUserId) } : {}),
      }
      await addCartItem(body)
      setToast(
        patientUserId
          ? `Added to ${patients.find((x) => String(x.userId) === String(patientUserId))?.name ?? 'patient'}'s cart`
          : 'Added to your cart',
      )
    } catch (e) {
      setError(e)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Practitioner · Catalog</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose whether additions go to <strong>your cart</strong> or a <strong>patient&apos;s shared cart</strong>.
          {patientUserId
            ? ' Prices shown are what the patient pays at checkout.'
            : ' Prices shown are your practitioner checkout rates.'}
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : null}
      {toast ? (
        <Alert>
          <AlertTitle>Cart updated</AlertTitle>
          <AlertDescription>{toast}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="border-primary/20 bg-primary/5 shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Add to which cart?</CardTitle>
          <CardDescription>
            Leave empty for your own cart (practitioner prices). Select a patient to add suggestions billed at patient prices.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:max-w-md">
          <Label htmlFor="target">Target cart</Label>
          <Select
            value={patientUserId === '' ? '__self' : String(patientUserId)}
            onValueChange={(v) => setPatientUserId(v === '__self' ? '' : v)}
          >
            <SelectTrigger id="target">
              <SelectValue placeholder="My cart (self-order)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                value="__self"
                label={user?.name ? `My cart (${user.name})` : 'My cart (self-order)'}
              >
                {user?.name ? `My cart (${user.name})` : 'My cart (self-order)'}
              </SelectItem>
              {patients.map((p) => (
                <SelectItem key={p.userId} value={String(p.userId)} label={p.name}>
                  Patient: {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {patientUserId ? (
            <Badge variant="secondary" className="w-fit">
              Items go to patient cart (shown as suggested)
            </Badge>
          ) : (
            <Badge variant="outline" className="w-fit">
              Items go to your practitioner cart
            </Badge>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Products ({products.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {products.map((p) => {
                const patientAmt = Number(p.patient_price ?? p.price ?? 0)
                const pracAmt = Number(p.practitioner_price ?? p.price ?? 0)
                const shown = patientUserId ? patientAmt : pracAmt
                const priceLabel = patientUserId ? 'Patient pays' : 'Your price'
                return (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3 last:border-0 last:pb-0"
                  >
                    <span>
                      {p.name} · {p.category} · {priceLabel}{' '}
                      <span className="font-medium tabular-nums">${shown.toFixed(2)}</span>
                    </span>
                    <Button type="button" size="sm" variant="outline" onClick={() => addToCart(p)}>
                      Add to cart
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
