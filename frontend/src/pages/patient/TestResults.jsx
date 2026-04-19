import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <pre className="max-h-96 overflow-auto rounded-lg bg-muted/50 p-4 text-xs">{JSON.stringify(rows, null, 2)}</pre>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
