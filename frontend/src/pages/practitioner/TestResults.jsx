import { useCallback, useEffect, useState } from 'react'
import { api, approveTestResult, contactTestResultCustomer } from '../../api/client'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

function downloadUrl(reportUrl) {
  return reportUrl.replace('/upload/', '/upload/fl_attachment/')
}

export default function PractitionerTestResults() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actingId, setActingId] = useState(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api('/lab/results')
      setRows(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleApprove(id) {
    try {
      setActingId(id)
      await approveTestResult(id)
      await load()
    } catch (e) {
      setError(e)
    } finally {
      setActingId(null)
    }
  }

  async function handleContact(id) {
    try {
      setActingId(id)
      await contactTestResultCustomer(id)
      await load()
    } catch (e) {
      setError(e)
    } finally {
      setActingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Practitioner · Test results</h1>
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : null}
      <Card className="overflow-hidden border-border/80 shadow-sm">
        <CardHeader className="space-y-4 border-b border-border/60 bg-gradient-to-b from-primary/[0.05] to-transparent pb-4">
          <CardTitle className="text-base font-medium">
            {rows.length === 1 ? '1 result' : `${rows.length} results`}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto pt-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !rows.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No reports yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Order</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Policy</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow
                    key={r.id}
                    className="group border-border/60 [&>td]:transition-colors [&:hover>td]:bg-muted/50"
                  >
                    <TableCell className="font-medium tabular-nums">#{r.orderId}</TableCell>
                    <TableCell className="max-w-[10rem] truncate text-sm">{r.patientName || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.policyNumber || '—'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={r.status === 'APPROVED' ? 'default' : 'secondary'} className="font-normal">
                          {r.status}
                        </Badge>
                        {r.contactRequestedAt ? (
                          <Badge variant="outline" className="font-normal">
                            Contact requested
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(r.reportUrl, '_blank', 'noopener,noreferrer')}
                        >
                          View
                        </Button>
                        <Button size="sm" variant="outline" render={<a href={downloadUrl(r.reportUrl)} download />}>
                          Download
                        </Button>
                        {r.orderType !== 'SELF' ? (
                          <>
                            {r.status !== 'APPROVED' ? (
                              <Button size="sm" disabled={actingId === r.id} onClick={() => handleApprove(r.id)}>
                                Approve
                              </Button>
                            ) : null}
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={actingId === r.id}
                              onClick={() => handleContact(r.id)}
                            >
                              Manual / Contact customer
                            </Button>
                          </>
                        ) : null}
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
