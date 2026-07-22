import { useCallback, useEffect, useState } from 'react'
import { api, approveTestResult, contactTestResultCustomer } from '../../api/client'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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
      <Card className="border-border/80 shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Results ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No reports yet.</p>
          ) : (
            <div className="divide-y">
              {rows.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{r.patientName || `Order #${r.orderId}`}</p>
                      <Badge variant={r.status === 'APPROVED' ? 'default' : 'secondary'}>{r.status}</Badge>
                      {r.contactRequestedAt ? <Badge variant="outline">Contact requested</Badge> : null}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.policyNumber ? `Policy ${r.policyNumber}` : `Order #${r.orderId}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
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
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
