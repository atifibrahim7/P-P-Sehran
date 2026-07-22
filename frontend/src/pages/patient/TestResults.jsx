import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function downloadUrl(reportUrl) {
  return reportUrl.replace('/upload/', '/upload/fl_attachment/')
}

export default function PatientTestResults() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    ;(async () => {
      try {
        setLoading(true)
        const data = await api('/lab/results')
        setRows(Array.isArray(data) ? data : [])
      } catch (e) {
        setError(e)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Patient · Test results</h1>
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
            <p className="p-6 text-sm text-muted-foreground">
              No reports available yet. Approved reports from your practitioner will appear here.
            </p>
          ) : (
            <div className="divide-y">
              {rows.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-medium">Order #{r.orderId}</p>
                    {r.summary ? <p className="truncate text-xs text-muted-foreground">{r.summary}</p> : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(r.reportUrl, '_blank', 'noopener,noreferrer')}
                    >
                      View
                    </Button>
                    <Button size="sm" render={<a href={downloadUrl(r.reportUrl)} download />}>
                      Download
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
