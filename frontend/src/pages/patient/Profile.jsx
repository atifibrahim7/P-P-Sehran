import { useEffect, useState } from 'react'
import { getMe } from '../../api/client'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function PatientProfile() {
  const [me, setMe] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    ;(async () => {
      try {
        setLoading(true)
        const data = await getMe()
        setMe(data)
      } catch (e) {
        setError(e)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Patient · Profile</h1>
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : null}
      <Card className="border-border/80 shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {loading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : me ? (
            <>
              <p>Name: {me.name}</p>
              <p>Email: {me.email}</p>
              <p>Role: {me.role}</p>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
