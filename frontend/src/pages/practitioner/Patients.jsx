import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPractitionerPatients } from '../../api/client'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

const PATIENT_KEY = 'pp_selected_patient_user_id'

export default function PractitionerPatients() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const openPatientCart = (userId) => {
    sessionStorage.setItem(PATIENT_KEY, String(userId))
    navigate('/practitioner/cart')
  }

  useEffect(() => {
    ;(async () => {
      try {
        setLoading(true)
        const data = await getPractitionerPatients()
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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Practitioner · Patients</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Patients assigned to your practice. Use their <strong>user id</strong> when building carts from the catalog, or pick them in the cart screen.
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
          <CardTitle className="text-base">Your patients ({rows.length})</CardTitle>
          <CardDescription>Admins link patients to you via the user record (patient profile).</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !rows.length ? (
            <p className="text-sm text-muted-foreground">No patients assigned yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">User ID</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => (
                  <TableRow key={p.userId}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-muted-foreground">{p.email}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="tabular-nums">
                        {p.userId}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button type="button" size="sm" variant="outline" onClick={() => openPatientCart(p.userId)}>
                        Open patient cart
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
