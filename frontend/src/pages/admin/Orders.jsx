import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getOrders } from '../../api/client'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'

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
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="overflow-hidden border-border/80 shadow-sm">
        <CardHeader className="border-b border-border/60 bg-gradient-to-b from-primary/[0.05] to-transparent">
          <CardTitle className="text-base">Orders ({orders.length})</CardTitle>
          <CardDescription>All practitioner and patient orders.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !orders.length ? (
            <p className="text-sm text-muted-foreground">No orders yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Order</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead className="text-right">Patient total</TableHead>
                  <TableHead className="text-right">Pract. total</TableHead>
                  <TableHead>Practitioner</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Inuvi</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow
                    key={o.id}
                    className="group cursor-pointer border-border/60 [&>td]:transition-colors [&:hover>td]:bg-muted/45"
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
                    <TableCell className="font-semibold tabular-nums">#{o.id}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal capitalize">
                        {String(o.type || '').replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize">{o.state}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{formatMoney(o.total_patient)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{formatMoney(o.total_practitioner)}</TableCell>
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
                    <TableCell>
                      {o.inuviOrderId ? (
                        <Badge variant="secondary" className="font-mono text-[10px]">
                          linked
                        </Badge>
                      ) : o.inuviSyncError ? (
                        <Badge variant="destructive" className="text-[10px]">
                          error
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/orders/${o.id}`)
                        }}
                      >
                        View
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
