import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye } from 'lucide-react'
import { api, patchCommissionPayout } from '../../api/client'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

function formatMoney(n) {
  if (n == null || Number.isNaN(n)) return '—'
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(n)
}

function formatDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return '—'
  }
}

export default function AdminCommissions() {
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [updatingId, setUpdatingId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api('/commissions')
      setPayload(Array.isArray(data) ? { commissions: data, totalsByPractitioner: [], summary: {} } : data)
      setError(null)
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const commissions = payload?.commissions || []
  const byPractitioner = payload?.totalsByPractitioner || []
  const summary = payload?.summary || {}

  const markPaid = async (id, next) => {
    setUpdatingId(id)
    try {
      await patchCommissionPayout(id, next)
      await load()
    } catch (e) {
      setError(e)
    } finally {
      setUpdatingId(null)
    }
  }

  const grandPending = summary.pendingPayoutTotal ?? 0
  const grandPaid = summary.paidOutTotal ?? 0

  const sortedPractitioners = useMemo(() => {
    return [...byPractitioner].sort((a, b) =>
      String(a.practitionerName || '').localeCompare(String(b.practitionerName || '')),
    )
  }, [byPractitioner])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin · Commissions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Practitioner earnings from patient orders. Mark a row as paid after you send the payout. Practitioners see the
          same payout status on their Commissions page.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/80 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending payout</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{loading ? '—' : formatMoney(grandPending)}</p>
            <p className="text-xs text-muted-foreground">Not yet marked paid to practitioners</p>
          </CardContent>
        </Card>
        <Card className="border-border/80 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Marked paid</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{loading ? '—' : formatMoney(grandPaid)}</p>
            <p className="text-xs text-muted-foreground">Recorded as paid out</p>
          </CardContent>
        </Card>
        <Card className="border-border/80 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Commission lines</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{loading ? '—' : commissions.length}</p>
            <p className="text-xs text-muted-foreground">One row per paid patient order</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/80 shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Totals by practitioner</CardTitle>
          <CardDescription>Pending vs paid totals for each practitioner.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !sortedPractitioners.length ? (
            <p className="text-sm text-muted-foreground">No commission records yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Practitioner</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                  <TableHead className="text-right">Paid out</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPractitioners.map((row) => (
                  <TableRow key={row.practitionerUserId}>
                    <TableCell className="font-medium">{row.practitionerName}</TableCell>
                    <TableCell className="text-muted-foreground">{row.practitionerEmail}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(row.pendingAmount)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(row.paidOutAmount)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{formatMoney(row.totalAmount)}</TableCell>
                    <TableCell className="text-right">{row.orderCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-none">
        <CardHeader>
          <CardTitle className="text-base">All commission lines</CardTitle>
          <CardDescription>Patient name, products (lab test or supplement), amount, and payout status.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !commissions.length ? (
            <p className="text-sm text-muted-foreground">No rows.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Practitioner</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead className="min-w-[200px]">Products</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Payout</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissions.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{r.practitionerName}</span>
                        <span className="text-xs text-muted-foreground">{r.practitionerEmail}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{r.patientName || '—'}</span>
                        {r.patientEmail ? (
                          <span className="text-xs text-muted-foreground">{r.patientEmail}</span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[280px] text-sm text-muted-foreground">{r.productsSummary}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <Link
                          to={`/orders/${r.orderId}`}
                          className="font-medium text-primary underline-offset-4 hover:underline"
                        >
                          #{r.orderId}
                        </Link>
                        <span className="text-xs text-muted-foreground">{formatDate(r.orderCreatedAt)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(r.amount)}</TableCell>
                    <TableCell>
                      {r.payoutStatus === 'PAID' ? (
                        <Badge variant="secondary">Paid</Badge>
                      ) : (
                        <Badge variant="outline">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button type="button" variant="ghost" size="icon" asChild title="View order">
                          <Link to={`/orders/${r.orderId}`}>
                            <Eye className="size-4" />
                          </Link>
                        </Button>
                        {r.payoutStatus === 'PENDING' ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={updatingId === r.id}
                            onClick={() => markPaid(r.id, 'PAID')}
                          >
                            Mark paid
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={updatingId === r.id}
                            onClick={() => markPaid(r.id, 'PENDING')}
                          >
                            Undo
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
