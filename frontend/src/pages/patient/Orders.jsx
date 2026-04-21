import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getOrders, startCheckout } from '../../api/client'
import OrderStateBadge from '../../components/order/OrderStateBadge.jsx'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { CreditCard, Loader2 } from 'lucide-react'

const FILTER_OPTIONS = [
  { value: 'all', label: 'All orders' },
  { value: 'pending', label: 'Needs payment' },
  { value: 'processing', label: 'In progress' },
  { value: 'done', label: 'Done' },
]

function formatMoney(n) {
  if (n == null || Number.isNaN(n)) return '—'
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(n)
}

function formatDate(iso) {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
  } catch {
    return String(iso)
  }
}

function matchesFilter(o, filter) {
  const s = String(o.state || '').toLowerCase()
  if (filter === 'all') return true
  if (filter === 'pending') return s === 'pending'
  if (filter === 'processing') return s === 'processing'
  if (filter === 'done') return s === 'paid' || s === 'completed'
  return true
}

export default function PatientOrders() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [payError, setPayError] = useState(null)
  const [cancelMsg, setCancelMsg] = useState(null)
  const [payingOrderId, setPayingOrderId] = useState(null)
  const [filter, setFilter] = useState('all')

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getOrders()
      setOrders(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const cancelFlag = searchParams.get('cancel')
  useEffect(() => {
    if (cancelFlag !== '1') return
    setCancelMsg('Checkout canceled. Try Pay again when ready.')
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev)
        n.delete('cancel')
        return n
      },
      { replace: true },
    )
  }, [cancelFlag, setSearchParams])

  const filtered = useMemo(() => orders.filter((o) => matchesFilter(o, filter)), [orders, filter])

  const pay = async (orderId) => {
    try {
      setPayError(null)
      setPayingOrderId(orderId)
      const origin = window.location.origin
      const successUrl = `${origin}/orders/${orderId}?paid=1`
      const cancelUrl = `${origin}/patient/orders?cancel=1`
      await startCheckout(orderId, successUrl, cancelUrl)
    } catch (e) {
      setPayError(e instanceof Error ? e : new Error(String(e)))
    } finally {
      setPayingOrderId(null)
    }
  }

  const showPayFor = (o) => o.type === 'patient' && o.state === 'pending'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every order tied to your account. Open one for line items and payment, or pay pending orders here.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : null}
      {payError ? (
        <Alert variant="destructive">
          <AlertTitle>Checkout</AlertTitle>
          <AlertDescription>{payError.message}</AlertDescription>
        </Alert>
      ) : null}
      {cancelMsg ? (
        <Alert>
          <AlertTitle>Canceled</AlertTitle>
          <AlertDescription>{cancelMsg}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="border-border/80 shadow-none">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <div>
            <CardTitle className="text-base">
              {loading ? 'Orders' : `Orders (${filtered.length}${filter !== 'all' ? ` of ${orders.length}` : ''})`}
            </CardTitle>
            <CardDescription>Date, practitioner when applicable, and your total.</CardDescription>
          </div>
          <div className="w-full sm:w-[220px]">
            <Select value={filter} onValueChange={setFilter} disabled={loading || !orders.length}>
              <SelectTrigger aria-label="Filter orders">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                {FILTER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-10 flex-1" />
                  <Skeleton className="h-10 w-24 max-md:hidden" />
                  <Skeleton className="h-10 w-32 max-lg:hidden" />
                </div>
              ))}
            </div>
          ) : !orders.length ? (
            <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-8 text-center">
              <p className="text-sm font-medium text-foreground">No orders yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                When your practitioner adds recommendations or you shop the catalog, orders show up here.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Link to="/patient/recommendations" className={cn(buttonVariants({ variant: 'default', size: 'sm' }), 'no-underline')}>
                  Recommendations
                </Link>
                <Link to="/patient/catalog" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'no-underline')}>
                  Catalog
                </Link>
              </div>
            </div>
          ) : !filtered.length ? (
            <p className="text-sm text-muted-foreground">No orders match this filter.</p>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Order</TableHead>
                      <TableHead>Practitioner</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Your total</TableHead>
                      <TableHead className="text-right w-[1%]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((o) => (
                      <TableRow key={o.id} className="[&>td]:align-middle">
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground tabular-nums">
                          {formatDate(o.createdAt)}
                        </TableCell>
                        <TableCell className="font-medium tabular-nums">#{o.id}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm">{o.practitionerName ?? '—'}</TableCell>
                        <TableCell>
                          <OrderStateBadge state={o.state} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(o.total_patient)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Link
                              to={`/orders/${o.id}`}
                              className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'no-underline')}
                            >
                              View
                            </Link>
                            {showPayFor(o) ? (
                              <Button
                                type="button"
                                size="sm"
                                className="gap-1.5"
                                disabled={payingOrderId != null}
                                onClick={() => pay(o.id)}
                              >
                                {payingOrderId === o.id ? (
                                  <>
                                    <Loader2 className="size-4 animate-spin" />
                                    Opening…
                                  </>
                                ) : (
                                  <>
                                    <CreditCard className="size-4" />
                                    Pay
                                  </>
                                )}
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <ul className="space-y-3 md:hidden">
                {filtered.map((o) => (
                  <li
                    key={o.id}
                    className="rounded-lg border border-border/60 bg-muted/15 p-4 space-y-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium tabular-nums">Order #{o.id}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">{formatDate(o.createdAt)}</p>
                      </div>
                      <OrderStateBadge state={o.state} />
                    </div>
                    {o.practitionerName ? (
                      <p className="text-sm text-muted-foreground">
                        <span className="text-foreground/80">Practitioner:</span> {o.practitionerName}
                      </p>
                    ) : null}
                    <p className="text-sm">
                      <span className="text-muted-foreground">Total:</span>{' '}
                      <span className="font-medium tabular-nums">{formatMoney(o.total_patient)}</span>
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Link
                        to={`/orders/${o.id}`}
                        className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'no-underline')}
                      >
                        View
                      </Link>
                      {showPayFor(o) ? (
                        <Button
                          type="button"
                          size="sm"
                          className="gap-1.5"
                          disabled={payingOrderId != null}
                          onClick={() => pay(o.id)}
                        >
                          {payingOrderId === o.id ? (
                            <>
                              <Loader2 className="size-4 animate-spin" />
                              Opening…
                            </>
                          ) : (
                            <>
                              <CreditCard className="size-4" />
                              Pay
                            </>
                          )}
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
