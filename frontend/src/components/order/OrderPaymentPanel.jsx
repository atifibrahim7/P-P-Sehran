import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Loader2,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import OrderStateBadge from './OrderStateBadge.jsx'

export default function OrderPaymentPanel({
  backTo,
  backLabel,
  order,
  items,
  userRole,
  isPatientViewer,
  showPay,
  amountDue,
  amountLabel,
  onPay,
  payDisabled,
  cancelMsg,
}) {
  const patientLine = isPatientViewer
  const adminView = userRole === 'admin'
  const paymentSubtitle = (() => {
    if (adminView) return 'Admin view'
    if (showPay && patientLine) return 'Ready to pay'
    if (showPay && userRole === 'practitioner') return 'Ready to pay'
    if (order.state === 'paid' || order.state === 'completed') return 'Paid'
    if (userRole === 'practitioner' && order.type === 'patient' && order.state === 'pending') return 'Patient pays this order'
    return 'Payment status'
  })()
  const ordersListPath =
    userRole === 'patient' ? '/patient/orders' : userRole === 'practitioner' ? '/practitioner/orders' : '/admin/orders'

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" className="-ml-2 mb-2 h-auto gap-1 px-2 text-muted-foreground" asChild>
            <Link to={backTo ?? ordersListPath}>
              <ArrowLeft className="size-4" />
              {backLabel ?? 'Back to orders'}
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Order #{order.id}</h1>
            <OrderStateBadge state={order.state} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {order.createdAt ? new Date(order.createdAt).toLocaleString() : null}
          </p>
        </div>
      </div>

      {cancelMsg ? (
        <Card className="border-amber-500/40 bg-amber-500/[0.06] shadow-none">
          <CardContent className="flex items-start gap-3 pt-6">
            <CreditCard className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-400" />
            <div>
              <p className="font-medium text-foreground">Checkout was canceled</p>
              <p className="text-sm text-muted-foreground">{cancelMsg}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="overflow-hidden border-border/80 shadow-sm lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Order details</CardTitle>
            <CardDescription>
              {!patientLine ? `Type: ${order.type}` : null}
              {order.practitionerName ? (
                <span className="block">Practitioner: {order.practitionerName}</span>
              ) : null}
              {!patientLine && order.patientName ? <span className="block">Patient: {order.patientName}</span> : null}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-0">
            {items.map((it, idx) => (
              <div key={idx}>
                {idx > 0 ? <Separator className="my-3" /> : null}
                <div className="flex items-start justify-between gap-4 rounded-lg px-2 py-1 text-sm">
                  <div>
                    <p className="font-medium leading-snug">{it.product?.name}</p>
                    <p className="text-xs text-muted-foreground">{it.product?.category}</p>
                  </div>
                  <span className="shrink-0 tabular-nums text-muted-foreground">× {it.quantity}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card
            className={cn(
              'overflow-hidden border shadow-md',
              !adminView && showPay ? 'border-primary/25 bg-gradient-to-b from-primary/[0.07] to-card' : 'border-border/80',
            )}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2 text-primary">
                <ShieldCheck className="size-5" />
                <CardTitle className="text-base">Payment</CardTitle>
              </div>
              <CardDescription className="text-left">{paymentSubtitle}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              <div className="rounded-xl border border-border/60 bg-background/80 px-4 py-3 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{amountLabel}</p>
                <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-foreground">${amountDue}</p>
                {!adminView && showPay ? (
                  <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <ShieldCheck className="size-3.5 shrink-0 opacity-80" />
                    Secure checkout
                  </p>
                ) : null}
              </div>

              {adminView ? (
                order.state === 'pending' ? (
                  <p className="rounded-lg border border-border/80 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                    Pending payment: the patient or assigned practitioner must pay from their portal.
                  </p>
                ) : order.state === 'paid' || order.state === 'completed' ? (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-900 dark:text-emerald-100">
                    <CheckCircle2 className="size-4 shrink-0" />
                    This order is paid.
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No payment action from admin.</p>
                )
              ) : showPay ? (
                <Button type="button" className="w-full gap-2 text-base shadow-sm" size="lg" onClick={onPay} disabled={payDisabled}>
                  {payDisabled ? (
                    <>
                      <Loader2 className="size-5 animate-spin" />
                      Opening checkout…
                    </>
                  ) : (
                    <>
                      <CreditCard className="size-5" />
                      Pay now
                    </>
                  )}
                </Button>
              ) : order.state === 'paid' || order.state === 'completed' ? (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-900 dark:text-emerald-100">
                  <CheckCircle2 className="size-4 shrink-0" />
                  This order is paid.
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {order.state === 'pending'
                    ? 'Payment is not available for your account on this order.'
                    : 'No payment action required.'}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
