import { useCallback, useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { getOrder, startCheckout } from '../../api/client'
import { useAuth } from '../../auth/AuthProvider.jsx'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function OrderDetail() {
  const { id } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [cancelMsg, setCancelMsg] = useState(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getOrder(id)
      setDetail(data)
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const paidFlag = searchParams.get('paid')
  useEffect(() => {
    if (paidFlag !== '1') return
    let ignore = false
    ;(async () => {
      await load()
      if (ignore) return
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev)
          n.delete('paid')
          return n
        },
        { replace: true },
      )
    })()
    return () => {
      ignore = true
    }
  }, [paidFlag, load, setSearchParams])

  const cancelFlag = searchParams.get('cancel')
  useEffect(() => {
    if (cancelFlag !== '1') return
    setCancelMsg('Checkout canceled. You can try again when ready.')
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev)
        n.delete('cancel')
        return n
      },
      { replace: true },
    )
  }, [cancelFlag, setSearchParams])

  const checkout = async () => {
    if (!detail?.order) return
    const origin = window.location.origin
    const successUrl = `${origin}/orders/${detail.order.id}?paid=1`
    const cancelUrl = `${origin}/orders/${detail.order.id}?cancel=1`
    await startCheckout(detail.order.id, successUrl, cancelUrl)
  }

  if (loading) return <div className="p-6 text-muted-foreground">Loading…</div>
  if (error)
    return (
      <Alert variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    )
  if (!detail) return null

  const { order, items } = detail
  const uid = user?.id
  const isPatientViewer = user?.role === 'patient'
  const canPatientPay =
    user?.role === 'patient' && order.type === 'patient' && order.patientId != null && Number(order.patientId) === Number(uid)
  const canPractitionerPay =
    user?.role === 'practitioner' &&
    order.type === 'practitioner_self' &&
    order.practitionerId != null &&
    Number(order.practitionerId) === Number(uid)
  const showPay = order.state === 'pending' && (canPatientPay || canPractitionerPay)
  const chargeLabel =
    order.type === 'patient'
      ? `Amount due (patient total): $${Number(order.total_patient).toFixed(2)}`
      : `Amount due (practitioner total): $${Number(order.total_practitioner).toFixed(2)}`

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight">Order #{order.id}</h1>
      {cancelMsg ? (
        <Alert>
          <AlertTitle>Canceled</AlertTitle>
          <AlertDescription>{cancelMsg}</AlertDescription>
        </Alert>
      ) : null}
      <Card className="border-border/80 shadow-none">
        <CardContent className="space-y-1 pt-6 text-sm">
          {!isPatientViewer ? <p>Type: {order.type}</p> : null}
          <p>State: {order.state}</p>
          {order.practitionerName ? <p>Practitioner: {order.practitionerName}</p> : null}
          {!isPatientViewer && order.patientName ? <p>Patient: {order.patientName}</p> : null}
          {isPatientViewer ? (
            <p className="font-medium tabular-nums">Your total: ${Number(order.total_patient).toFixed(2)}</p>
          ) : (
            <p>
              Totals: patient ${order.total_patient} · practitioner ${order.total_practitioner}
            </p>
          )}
          {!isPatientViewer && order.type === 'patient' ? <p className="text-muted-foreground">{chargeLabel}</p> : null}
          {!isPatientViewer && order.type === 'practitioner_self' ? (
            <p className="text-muted-foreground">{chargeLabel}</p>
          ) : null}
        </CardContent>
      </Card>
      <Card className="border-border/80 shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Items</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-inside list-disc space-y-1 text-sm">
            {items.map((it, idx) => (
              <li key={idx}>
                {it.product.name} × {it.quantity} ({it.product.category})
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      {showPay ? (
        <Button type="button" onClick={checkout}>
          Proceed to checkout
        </Button>
      ) : null}
      {order.state === 'pending' && user?.role === 'admin' ? (
        <p className="text-sm text-muted-foreground">Admin view: payment must be completed by the patient or practitioner on this order.</p>
      ) : null}
      {order.state === 'pending' && user?.role === 'patient' && order.type === 'patient' && !canPatientPay ? (
        <p className="text-sm text-muted-foreground">This order belongs to another patient account.</p>
      ) : null}
      {order.state === 'pending' && user?.role === 'practitioner' && order.type === 'practitioner_self' && !canPractitionerPay ? (
        <p className="text-sm text-muted-foreground">This self-order belongs to another practitioner.</p>
      ) : null}
    </div>
  )
}
