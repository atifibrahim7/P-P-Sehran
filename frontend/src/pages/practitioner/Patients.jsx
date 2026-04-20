import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShoppingBag, Search, UserRound } from 'lucide-react'
import { getPractitionerPatients } from '../../api/client'
import { PRACTITIONER_PATIENT_USER_KEY } from '../../context/PractitionerCartContext.jsx'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

function initials(name) {
  const parts = (name || '').trim().split(/\s+/)
  if (!parts[0]) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function PractitionerPatients() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [remoteLoading, setRemoteLoading] = useState(false)

  const load = useCallback(async (q) => {
    try {
      setRemoteLoading(true)
      setError(null)
      const data = await getPractitionerPatients(q ? { q } : {})
      setRows(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e)
    } finally {
      setRemoteLoading(false)
      setLoading(false)
    }
  }, [])

  const didInit = useRef(false)
  useEffect(() => {
    if (!didInit.current) {
      didInit.current = true
      load('')
      return
    }
    const t = setTimeout(() => load(query.trim()), 320)
    return () => clearTimeout(t)
  }, [query, load])

  const openPatientCart = (userId) => {
    sessionStorage.setItem(PRACTITIONER_PATIENT_USER_KEY, String(userId))
    navigate('/practitioner/catalog/lab-test')
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 border-b border-border/60 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Patients</h1>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Everyone with a patient account appears here. Pick someone to build or checkout an order on their behalf from
            the catalog or cart.
          </p>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="overflow-hidden border-border/80 shadow-sm">
        <CardHeader className="space-y-3 border-b border-border/60 bg-muted/30 pb-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Directory</CardTitle>
              <CardDescription>
                {loading && !rows.length ? (
                  'Loading directory…'
                ) : (
                  <>
                    <span className="tabular-nums">{rows.length}</span> patient{rows.length === 1 ? '' : 's'}
                    {query.trim() ? ' match your search' : ' in the system'}
                  </>
                )}
              </CardDescription>
            </div>
          </div>
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-10 bg-background pl-9"
              placeholder="Search by name or email…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search patients"
            />
            {remoteLoading ? (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium uppercase text-muted-foreground">
                …
              </span>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading && !rows.length ? (
            <div className="space-y-3 p-6">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          ) : !rows.length ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No patients found{query.trim() ? ' for this search' : ''}. Create patient accounts under Admin → Users.
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {rows.map((p) => (
                <li key={p.userId}>
                  <div
                    className={cn(
                      'flex flex-col gap-4 p-4 transition-colors sm:flex-row sm:items-center sm:justify-between',
                      'hover:bg-muted/40',
                    )}
                  >
                    <div className="flex min-w-0 gap-3">
                      <div
                        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
                        aria-hidden
                      >
                        {initials(p.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium leading-tight">{p.name}</p>
                          {p.primaryPractitionerName ? (
                            <Badge variant="secondary" className="max-w-[14rem] truncate font-normal">
                              Primary clinic · {p.primaryPractitionerName}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="font-normal text-muted-foreground">
                              No primary clinic set
                            </Badge>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-sm text-muted-foreground">{p.email}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          <UserRound className="mr-1 inline size-3 align-text-bottom opacity-70" />
                          User <span className="tabular-nums">{p.userId}</span> · Patient{' '}
                          <span className="tabular-nums">{p.patientId}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                      <Button
                        type="button"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => openPatientCart(p.userId)}
                      >
                        <ShoppingBag className="size-3.5" />
                        Order for patient
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Patient portal shared carts still follow the patient&apos;s <strong>primary clinic</strong> link when one is set.
        Orders you create are always under your practitioner account.
      </p>
    </div>
  )
}
