import { useCallback, useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { getOrder, retryOrderInuviSync, startCheckout } from '../../api/client'
import { useAuth } from '../../auth/AuthProvider.jsx'
import OrderPaymentPanel from '../../components/order/OrderPaymentPanel.jsx'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

export default function OrderDetail() {
  const { id } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [cancelMsg, setCancelMsg] = useState(null)
  const [checkoutBusy, setCheckoutBusy] = useState(false)
  const [inuviBusy, setInuviBusy] = useState(false)

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
    setCancelMsg('Checkout was canceled. You can try again when you are ready.')
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev)
        n.delete('cancel')
        return n
      },
      { replace: true },
    )
  }, [cancelFlag, setSearchParams])

  const retryInuvi = async () => {
    if (!detail?.order?.id) return
    setInuviBusy(true)
    setError(null)
    try {
      const data = await retryOrderInuviSync(detail.order.id)
      setDetail(data)
    } catch (e) {
      setError(e)
    } finally {
      setInuviBusy(false)
    }
  }

  const checkout = async () => {
    if (!detail?.order) return
    const origin = window.location.origin
    const successUrl = `${origin}/orders/${detail.order.id}?paid=1`
    const cancelUrl = `${origin}/orders/${detail.order.id}?cancel=1`
    setCheckoutBusy(true)
    try {
      await startCheckout(detail.order.id, successUrl, cancelUrl)
    } catch (e) {
      setError(e)
    } finally {
      setCheckoutBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading order…</p>
      </div>
    )
  }
  if (error) {
    return (
      <Alert variant="destructive" className="max-w-lg">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    )
  }
  if (!detail) return null

  const { order, items } = detail
  const uid = user?.id
  const isPatientViewer = user?.role === 'patient'
  const canPatientPay =
    user?.role === 'patient' &&
    order.type === 'patient' &&
    order.patientId != null &&
    Number(order.patientId) === Number(uid)
  const canPractitionerPay =
    user?.role === 'practitioner' &&
    order.type === 'practitioner_self' &&
    order.practitionerId != null &&
    Number(order.practitionerId) === Number(uid)
  const showPay = order.state === 'pending' && (canPatientPay || canPractitionerPay)

  const amountDue =
    order.type === 'patient'
      ? Number(order.total_patient).toFixed(2)
      : Number(order.total_practitioner).toFixed(2)
  const amountLabel =
    order.type === 'patient' ? 'Amount due (patient total)' : 'Amount due (practitioner total)'

  const showInuviAdmin = user?.role === 'admin'
  const inuviPublic =
    Boolean(order.inuviOrderId) || Boolean(order.inuviSyncError) || Boolean(order.inuviSyncedAt)

  return (
    <div className="space-y-6">
      {inuviPublic ? (
        <Alert variant={order.inuviSyncError && !order.inuviOrderId ? 'destructive' : 'default'}>
          <AlertTitle>Inuvi</AlertTitle>
          <AlertDescription className="space-y-1 text-sm">
            {order.inuviOrderId ? (
              <p>
                <span className="text-muted-foreground">Order ID: </span>
                <span className="font-mono text-xs">{order.inuviOrderId}</span>
              </p>
            ) : null}
            {order.inuviSyncedAt ? (
              <p className="text-muted-foreground">Last synced: {new Date(order.inuviSyncedAt).toLocaleString()}</p>
            ) : null}
            {order.inuviSyncError ? (
              <p className="whitespace-pre-wrap break-all text-xs">{order.inuviSyncError}</p>
            ) : null}
            {showInuviAdmin && !order.inuviOrderId ? (
              <Button type="button" variant="outline" size="sm" className="mt-2" disabled={inuviBusy} onClick={retryInuvi}>
                {inuviBusy ? 'Retrying…' : 'Retry Inuvi sync'}
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : showInuviAdmin ? (
        <Alert>
          <AlertTitle>Inuvi</AlertTitle>
          <AlertDescription className="flex flex-col gap-2 text-sm">
            <span className="text-muted-foreground">No Inuvi link yet.</span>
            <Button type="button" variant="outline" size="sm" className="w-fit" disabled={inuviBusy} onClick={retryInuvi}>
              {inuviBusy ? 'Retrying…' : 'Retry Inuvi sync'}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <OrderPaymentPanel
        order={order}
        items={items}
        userRole={user?.role}
        isPatientViewer={isPatientViewer}
        showPay={showPay}
        amountDue={amountDue}
        amountLabel={amountLabel}
        onPay={checkout}
        payDisabled={checkoutBusy}
        cancelMsg={cancelMsg}
      />

      {order.state === 'pending' && user?.role === 'patient' && order.type === 'patient' && !canPatientPay ? (
        <Alert>
          <AlertTitle>Restricted</AlertTitle>
          <AlertDescription>This order belongs to another patient account.</AlertDescription>
        </Alert>
      ) : null}
      {order.state === 'pending' && user?.role === 'practitioner' && order.type === 'practitioner_self' && !canPractitionerPay ? (
        <Alert>
          <AlertTitle>Restricted</AlertTitle>
          <AlertDescription>This self-order belongs to another practitioner.</AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}
