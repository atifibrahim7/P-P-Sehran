import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye } from 'lucide-react'
import { api } from '../../api/client'
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

export default function PractitionerCommissions() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    ;(async () => {
      try {
        setLoading(true)
        const data = await api('/commissions')
        setRows(Array.isArray(data) ? data : [])
      } catch (e) {
        setError(e)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const pendingTotal = rows.filter((r) => r.payoutStatus !== 'PAID').reduce((s, r) => s + Number(r.amount || 0), 0)
  const paidTotal = rows.filter((r) => r.payoutStatus === 'PAID').reduce((s, r) => s + Number(r.amount || 0), 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Commissions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Earnings from patient orders (after the patient pays). Payout status is updated by the platform admin when they
          send your payment.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-border/80 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending from admin</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{loading ? '—' : formatMoney(pendingTotal)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/80 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Marked paid</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{loading ? '—' : formatMoney(paidTotal)}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/80 shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Commission history</CardTitle>
          <CardDescription>Patient, products sold, and your commission per order.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !rows.length ? (
            <p className="text-sm text-muted-foreground">No commissions yet. Paid patient orders will appear here.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead className="min-w-[200px]">Products</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                  <TableHead>Payout</TableHead>
                  <TableHead className="w-[100px] text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{r.patientName || '—'}</span>
                        {r.patientEmail ? (
                          <span className="text-xs text-muted-foreground">{r.patientEmail}</span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[320px] text-sm text-muted-foreground">{r.productsSummary}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">#{r.orderId}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(r.orderCreatedAt)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{formatMoney(r.amount)}</TableCell>
                    <TableCell>
                      {r.payoutStatus === 'PAID' ? (
                        <Badge variant="secondary">Paid</Badge>
                      ) : (
                        <Badge variant="outline">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button type="button" variant="ghost" size="icon" asChild title="View order">
                        <Link to={`/orders/${r.orderId}`}>
                          <Eye className="size-4" />
                        </Link>
                      </Button>
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
