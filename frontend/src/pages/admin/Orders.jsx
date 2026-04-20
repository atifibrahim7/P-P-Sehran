import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getOrders } from '../../api/client'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

function formatMoney(n) {
  if (n == null || Number.isNaN(n)) return '—'
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(n)
}

export default function AdminOrders() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    ;(async () => {
      try {
        setLoading(true)
        const data = await getOrders()
        setOrders(Array.isArray(data) ? data : [])
      } catch (e) {
        setError(e)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin · Orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          All orders across practitioners and patients. Open a row for payment and line items.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="border-border/80 shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Orders ({orders.length})</CardTitle>
          <CardDescription>Practitioner and patient names (from linked accounts).</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !orders.length ? (
            <p className="text-sm text-muted-foreground">No orders yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead className="text-right">Patient total</TableHead>
                  <TableHead className="text-right">Pract. total</TableHead>
                  <TableHead>Practitioner</TableHead>
                  <TableHead>Patient</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow
                    key={o.id}
                    className="cursor-pointer [&>td]:transition-colors [&:hover>td]:bg-muted"
                    tabIndex={0}
                    aria-label={`View order ${o.id}`}
                    onClick={() => navigate(`/orders/${o.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        navigate(`/orders/${o.id}`)
                      }
                    }}
                  >
                    <TableCell className="font-medium tabular-nums">#{o.id}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal">
                        {String(o.type || '').replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>{o.state}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(o.total_patient)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(o.total_practitioner)}</TableCell>
                    <TableCell className="max-w-[140px]">
                      <span className="line-clamp-2 text-sm font-medium text-foreground" title={o.practitionerName || ''}>
                        {o.practitionerName ?? '—'}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[140px]">
                      <span className="line-clamp-2 text-sm font-medium text-foreground" title={o.patientName || ''}>
                        {o.patientName ?? '—'}
                      </span>
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
