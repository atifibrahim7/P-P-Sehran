import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShoppingBag, Search, UserRound } from 'lucide-react'
import { getPractitionerPatients } from '../../api/client'
import PractitionerCreatePatientDialog from '../../components/practitioner/PractitionerCreatePatientDialog.jsx'
import {
  PRACTITIONER_PATIENT_HINT_KEY,
  PRACTITIONER_PATIENT_USER_KEY,
} from '../../context/PractitionerCartContext.jsx'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 20

function initials(name) {
  const parts = (name || '').trim().split(/\s+/)
  if (!parts[0]) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function PractitionerPatients() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [remoteLoading, setRemoteLoading] = useState(false)

  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  const load = useCallback(async (q, p) => {
    try {
      setRemoteLoading(true)
      setError(null)
      const data = await getPractitionerPatients({ q: q || undefined, page: p, limit: PAGE_SIZE })
      setRows(Array.isArray(data?.items) ? data.items : [])
      setTotal(Number(data?.total) || 0)
      setPage(Number(data?.page) || p)
    } catch (e) {
      setError(e)
    } finally {
      setRemoteLoading(false)
      setLoading(false)
    }
  }, [])

  const skipQueryDebounce = useRef(true)
  useEffect(() => {
    load('', 1)
  }, [load])

  useEffect(() => {
    if (skipQueryDebounce.current) {
      skipQueryDebounce.current = false
      return
    }
    const t = setTimeout(() => {
      load(query.trim(), 1)
    }, 320)
    return () => clearTimeout(t)
  }, [query, load])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const rangeStart = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(total, safePage * PAGE_SIZE)

  const openPatientCart = (row) => {
    sessionStorage.setItem(PRACTITIONER_PATIENT_USER_KEY, String(row.userId))
    try {
      sessionStorage.setItem(
        PRACTITIONER_PATIENT_HINT_KEY,
        JSON.stringify({ userId: row.userId, name: row.name, email: row.email }),
      )
    } catch {
      /* ignore */
    }
    navigate('/practitioner/catalog/lab-test')
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between border-b border-border/60 pb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Patients</h1>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : null}

      <PractitionerCreatePatientDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        title="Add patient"
        onCreated={async () => {
          await load(query.trim(), 1)
        }}
      />

      <div className="flex justify-end">
        <Button type="button" onClick={() => setCreateDialogOpen(true)}>
          Add patient
        </Button>
      </div>

      <Card className="overflow-hidden border-border/80 shadow-sm">
        <CardHeader className="space-y-3 border-b border-border/60 bg-muted/30 pb-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">
                {loading && !rows.length ? 'Loading…' : (
                  <span>
                    <span className="tabular-nums">{total}</span> patient{total === 1 ? '' : 's'}
                    {total > 0 && !loading ? (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {rangeStart}–{rangeEnd}
                      </span>
                    ) : null}
                  </span>
                )}
              </CardTitle>
            </div>
            {totalPages > 1 ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={safePage <= 1 || remoteLoading}
                  onClick={() => load(query.trim(), Math.max(1, safePage - 1))}
                >
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground">
                  Page <span className="tabular-nums">{safePage}</span> /{' '}
                  <span className="tabular-nums">{totalPages}</span>
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={safePage >= totalPages || remoteLoading}
                  onClick={() => load(query.trim(), Math.min(totalPages, safePage + 1))}
                >
                  Next
                </Button>
              </div>
            ) : null}
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
              No patients found{query.trim() ? ' for this search' : ''}. Use Add patient above to create one.
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
                        onClick={() => openPatientCart(p)}
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

    </div>
  )
}
