import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { getCommissionsPage, getOrder, getOrdersPage } from '../../api/client'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { Eye } from 'lucide-react'

const COMMISSIONS_ANCHOR_ID = 'practitioner-commissions'

const PAGE_SIZE = 10
const STATE_OPTIONS = [
  { value: 'all', label: 'All states' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'paid', label: 'Paid' },
  { value: 'completed', label: 'Completed' },
]

const COMMISSION_PAYOUT_OPTIONS = [
  { value: 'all', label: 'All payouts' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'PAID', label: 'Paid' },
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

function patientOrderCommission(o) {
  return Math.max(0, Number(o.total_patient ?? 0) - Number(o.total_practitioner ?? 0))
}

function typeLabel(t) {
  if (t === 'patient') return 'Patient'
  if (t === 'practitioner_self') return 'Self'
  return String(t || '').replace(/_/g, ' ')
}

export default function PractitionerOrders() {
  const location = useLocation()
  const [commissionPage, setCommissionPage] = useState(1)
  const [commissionQ, setCommissionQ] = useState('')
  const [commissionDebouncedQ, setCommissionDebouncedQ] = useState('')
  const [commissionPayoutFilter, setCommissionPayoutFilter] = useState('all')
  const [commissionItems, setCommissionItems] = useState([])
  const [commissionPagination, setCommissionPagination] = useState({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  })
  const [commissionSummary, setCommissionSummary] = useState({
    pendingPayoutTotal: 0,
    paidOutTotal: 0,
    pendingLineCount: 0,
  })
  const [commissionLoading, setCommissionLoading] = useState(true)
  const [commissionError, setCommissionError] = useState(null)

  const [tab, setTab] = useState('all')
  const [page, setPage] = useState(1)
  const [stateFilter, setStateFilter] = useState('all')
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [orders, setOrders] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailId, setDetailId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 350)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    const t = setTimeout(() => setCommissionDebouncedQ(commissionQ.trim()), 350)
    return () => clearTimeout(t)
  }, [commissionQ])

  useEffect(() => {
    setCommissionPage(1)
  }, [commissionDebouncedQ, commissionPayoutFilter])

  const loadCommissions = useCallback(async () => {
    try {
      setCommissionLoading(true)
      setCommissionError(null)
      const params = {
        page: commissionPage,
        pageSize: PAGE_SIZE,
        ...(commissionDebouncedQ ? { q: commissionDebouncedQ } : {}),
        ...(commissionPayoutFilter !== 'all' ? { payoutStatus: commissionPayoutFilter } : {}),
      }
      const data = await getCommissionsPage(params)
      setCommissionItems(data.items || [])
      setCommissionPagination(
        data.pagination || { page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1 },
      )
      setCommissionSummary(
        data.summary || { pendingPayoutTotal: 0, paidOutTotal: 0, pendingLineCount: 0 },
      )
    } catch (e) {
      setCommissionError(e)
      setCommissionItems([])
    } finally {
      setCommissionLoading(false)
    }
  }, [commissionPage, commissionDebouncedQ, commissionPayoutFilter])

  useEffect(() => {
    loadCommissions()
  }, [loadCommissions])

  useEffect(() => {
    if (location.hash !== `#${COMMISSIONS_ANCHOR_ID}`) return
    const el = document.getElementById(COMMISSIONS_ANCHOR_ID)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [location.hash])

  const typeParam = useMemo(() => {
    if (tab === 'patient') return 'patient'
    if (tab === 'self') return 'practitioner_self'
    return ''
  }, [tab])

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const params = {
        page,
        pageSize: PAGE_SIZE,
        ...(typeParam ? { type: typeParam } : {}),
        ...(stateFilter && stateFilter !== 'all' ? { state: stateFilter } : {}),
        ...(debouncedQ ? { q: debouncedQ } : {}),
      }
      const res = await getOrdersPage(params)
      setOrders(res.items || [])
      setPagination(res.pagination || { page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1 })
    } catch (e) {
      setError(e)
      setOrders([])
    } finally {
      setLoading(false)
    }
  }, [page, typeParam, stateFilter, debouncedQ])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setPage(1)
  }, [debouncedQ])

  const openDetail = (id) => {
    setDetailId(id)
    setDetail(null)
    setDetailError(null)
    setDetailOpen(true)
  }

  useEffect(() => {
    if (!detailOpen || detailId == null) return
    let ignore = false
    ;(async () => {
      try {
        setDetailLoading(true)
        setDetailError(null)
        const data = await getOrder(detailId)
        if (!ignore) setDetail(data)
      } catch (e) {
        if (!ignore) setDetailError(e)
      } finally {
        if (!ignore) setDetailLoading(false)
      }
    })()
    return () => {
      ignore = true
    }
  }, [detailOpen, detailId])

  const onDialogOpenChange = (open) => {
    setDetailOpen(open)
    if (!open) {
      setDetailId(null)
      setDetail(null)
      setDetailError(null)
    }
  }

  const { page: curPage, totalPages, total } = pagination
  const {
    page: comPage,
    totalPages: comTotalPages,
    total: comTotal,
  } = commissionPagination
  const commissionFilterActive =
    Boolean(commissionDebouncedQ) || commissionPayoutFilter !== 'all'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
      </div>

      <div id={COMMISSIONS_ANCHOR_ID} className="scroll-mt-6 space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Commission</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="border-border/80 bg-gradient-to-br from-primary/[0.04] to-card shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending from admin</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums tracking-tight">
                {commissionLoading ? '—' : formatMoney(commissionSummary.pendingPayoutTotal)}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/80 bg-gradient-to-br from-primary/[0.04] to-card shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Marked paid</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums tracking-tight">
                {commissionLoading ? '—' : formatMoney(commissionSummary.paidOutTotal)}
              </p>
            </CardContent>
          </Card>
        </div>

        {commissionError ? (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{commissionError.message}</AlertDescription>
          </Alert>
        ) : null}

        <Card className="overflow-hidden border-border/80 shadow-sm">
          <CardHeader className="space-y-4 border-b border-border/60 bg-gradient-to-b from-primary/[0.05] to-transparent pb-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <CardTitle className="text-base font-medium">Commission history</CardTitle>
                <CardDescription className="mt-1">Per-order payout lines.</CardDescription>
                <p className="mt-2 text-sm text-muted-foreground">
                  {comTotal === 1 ? '1 line' : `${comTotal} lines`}
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="space-y-1.5">
                  <Label htmlFor="commission-search" className="text-xs text-muted-foreground">
                    Search
                  </Label>
                  <Input
                    id="commission-search"
                    placeholder="Order # or patient name…"
                    value={commissionQ}
                    onChange={(e) => setCommissionQ(e.target.value)}
                    className="w-full sm:w-56"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Payout</Label>
                  <Select
                    value={commissionPayoutFilter}
                    onValueChange={(v) => {
                      setCommissionPayoutFilter(v)
                      setCommissionPage(1)
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-44">
                      <SelectValue placeholder="Payout" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMISSION_PAYOUT_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {commissionLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : !commissionItems.length ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {commissionFilterActive
                  ? 'No commissions match your filters.'
                  : 'No commissions yet. Paid patient orders will appear here.'}
              </p>
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b hover:bg-transparent">
                        <TableHead className="font-medium">Patient</TableHead>
                        <TableHead className="min-w-[200px] font-medium">Products</TableHead>
                        <TableHead className="font-medium">Order</TableHead>
                        <TableHead className="text-right font-medium">Commission</TableHead>
                        <TableHead className="font-medium">Payout</TableHead>
                        <TableHead className="w-14 text-right font-medium"> </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {commissionItems.map((r) => (
                        <TableRow
                          key={r.id}
                          className="group border-border/60 [&>td]:py-3 [&>td]:transition-colors [&:hover>td]:bg-muted/50"
                        >
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              <span className="font-medium leading-tight">{r.patientName || '—'}</span>
                              {r.patientEmail ? (
                                <span className="text-xs text-muted-foreground">{r.patientEmail}</span>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[min(24rem,40vw)] text-sm leading-snug text-muted-foreground">
                            {r.productsSummary}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              <span className="font-medium tabular-nums text-foreground">#{r.orderId}</span>
                              <span className="text-xs text-muted-foreground tabular-nums">
                                {formatDate(r.orderCreatedAt)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-base tabular-nums font-semibold text-foreground">
                            {formatMoney(r.amount)}
                          </TableCell>
                          <TableCell>
                            {r.payoutStatus === 'PAID' ? (
                              <Badge className="font-normal shadow-none" variant="secondary">
                                Paid
                              </Badge>
                            ) : (
                              <Badge className="font-normal shadow-none" variant="outline">
                                Pending
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="h-8 w-8 opacity-70 transition-opacity group-hover:opacity-100"
                              title="View order"
                              aria-label={`View order ${r.orderId}`}
                              onClick={() => openDetail(r.orderId)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="space-y-3 md:hidden">
                  {commissionItems.map((r) => (
                    <div
                      key={r.id}
                      className="rounded-xl border border-border/80 bg-card/50 p-4 shadow-sm transition-colors hover:bg-muted/30"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="font-medium leading-tight">{r.patientName || '—'}</p>
                          {r.patientEmail ? (
                            <p className="text-xs text-muted-foreground">{r.patientEmail}</p>
                          ) : null}
                          <p className="text-xs tabular-nums text-muted-foreground">
                            Order #{r.orderId} · {formatDate(r.orderCreatedAt)}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <span className="text-lg font-semibold tabular-nums">{formatMoney(r.amount)}</span>
                          {r.payoutStatus === 'PAID' ? (
                            <Badge className="font-normal" variant="secondary">
                              Paid
                            </Badge>
                          ) : (
                            <Badge className="font-normal" variant="outline">
                              Pending
                            </Badge>
                          )}
                        </div>
                      </div>
                      <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{r.productsSummary}</p>
                      <div className="mt-3 flex justify-end border-t border-border/60 pt-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => openDetail(r.orderId)}
                        >
                          <Eye className="h-4 w-4" />
                          Details
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {!commissionLoading && comTotal > 0 ? (
                  <div className="mt-4 flex flex-col items-center justify-between gap-3 border-t pt-4 text-sm sm:flex-row">
                    <p className="text-muted-foreground">
                      Page {comPage} of {comTotalPages}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={comPage <= 1}
                        onClick={() => setCommissionPage((p) => Math.max(1, p - 1))}
                      >
                        Previous
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={comPage >= comTotalPages}
                        onClick={() => setCommissionPage((p) => p + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Orders</h2>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2 rounded-lg border bg-muted/30 p-1">
        {[
          { id: 'all', label: 'All' },
          { id: 'patient', label: 'Patient orders' },
          { id: 'self', label: 'Self orders' },
        ].map((t) => (
          <Button
            key={t.id}
            type="button"
            variant={tab === t.id ? 'default' : 'ghost'}
            size="sm"
            className={cn('rounded-md shadow-none', tab === t.id && 'shadow-sm')}
            onClick={() => {
              setTab(t.id)
              setPage(1)
            }}
          >
            {t.label}
          </Button>
        ))}
      </div>

      <Card className="overflow-hidden border-border/80 shadow-sm">
        <CardHeader className="space-y-4 border-b border-border/60 bg-gradient-to-b from-primary/[0.05] to-transparent pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <CardTitle className="text-base font-medium">
              {total === 1 ? '1 order' : `${total} orders`}
            </CardTitle>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="space-y-1.5">
                <Label htmlFor="order-search" className="text-xs text-muted-foreground">
                  Search
                </Label>
                <Input
                  id="order-search"
                  placeholder="Order # or patient name…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="w-full sm:w-56"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">State</Label>
                <Select
                  value={stateFilter}
                  onValueChange={(v) => {
                    setStateFilter(v)
                    setPage(1)
                  }}
                >
                  <SelectTrigger className="w-full sm:w-44">
                    <SelectValue placeholder="State" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto pt-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !orders.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No orders match your filters.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-12 text-center"> </TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead className="text-right">Order value</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                  <TableHead className="text-right">To be paid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => {
                  const isPatient = o.type === 'patient'
                  return (
                    <TableRow
                      key={o.id}
                      className="group border-border/60 [&>td]:transition-colors [&:hover>td]:bg-muted/50"
                    >
                      <TableCell className="text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="h-8 w-8"
                          aria-label={`View order ${o.id}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            openDetail(o.id)
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium tabular-nums">#{o.id}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums text-xs">
                        {formatDate(o.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-normal">
                          {typeLabel(o.type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[10rem] truncate text-sm">
                        {isPatient ? o.patientName || '—' : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            'font-normal capitalize',
                            String(o.state).toLowerCase() === 'paid' &&
                              'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/50 dark:text-green-300',
                          )}
                        >
                          {o.state}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {isPatient ? formatMoney(o.total_patient) : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {isPatient ? formatMoney(patientOrderCommission(o)) : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {isPatient ? '—' : formatMoney(o.total_practitioner)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}

          {!loading && total > 0 ? (
            <div className="mt-4 flex flex-col items-center justify-between gap-3 border-t pt-4 text-sm sm:flex-row">
              <p className="text-muted-foreground">
                Page {curPage} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={curPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={curPage >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={detailOpen} onOpenChange={onDialogOpenChange}>
        <DialogContent className="max-h-[min(90vh,640px)] overflow-y-auto sm:max-w-lg" showCloseButton>
          <DialogHeader>
            <DialogTitle>{detailId != null ? `Order #${detailId}` : 'Order'}</DialogTitle>
            <DialogDescription>Line items and totals for this order.</DialogDescription>
          </DialogHeader>
          {detailLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : detailError ? (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{detailError.message}</AlertDescription>
            </Alert>
          ) : detail?.order ? (
            <div className="space-y-4 text-sm">
              <div className="grid gap-2 rounded-lg border bg-muted/20 p-3">
                <p>
                  <span className="text-muted-foreground">Type:</span> {typeLabel(detail.order.type)}
                </p>
                <p>
                  <span className="text-muted-foreground">State:</span>{' '}
                  <span className="capitalize">{detail.order.state}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Placed:</span> {formatDate(detail.order.createdAt)}
                </p>
                {detail.order.type === 'patient' ? (
                  <p>
                    <span className="text-muted-foreground">Patient total:</span>{' '}
                    {formatMoney(detail.order.total_patient)}
                  </p>
                ) : (
                  <p>
                    <span className="text-muted-foreground">Your total:</span>{' '}
                    {formatMoney(detail.order.total_practitioner)}
                  </p>
                )}
              </div>
              <div>
                <p className="mb-2 font-medium">Items</p>
                <ul className="space-y-2 rounded-lg border p-3">
                  {(detail.items || []).map((it) => (
                    <li key={it.id} className="flex justify-between gap-2 border-b border-border/50 pb-2 last:border-0 last:pb-0">
                      <span className="min-w-0 flex-1 truncate">
                        {it.product?.name ?? `Product #${it.productId}`}
                        {it.product?.category ? (
                          <span className="text-muted-foreground"> · {String(it.product.category)}</span>
                        ) : null}
                      </span>
                      <span className="shrink-0 tabular-nums">×{it.quantity ?? 1}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
          <DialogFooter className="sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => onDialogOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  )
}
