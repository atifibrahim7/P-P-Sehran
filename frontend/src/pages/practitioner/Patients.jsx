import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShoppingBag, Search, UserRound } from 'lucide-react'
import { createPractitionerPatient, getPractitionerPatients } from '../../api/client'
import {
  PRACTITIONER_PATIENT_HINT_KEY,
  PRACTITIONER_PATIENT_USER_KEY,
} from '../../context/PractitionerCartContext.jsx'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [createBusy, setCreateBusy] = useState(false)
  const [createError, setCreateError] = useState(null)
  const [createOk, setCreateOk] = useState(null)

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

  const onCreatePatient = async (e) => {
    e.preventDefault()
    setCreateError(null)
    setCreateOk(null)
    setCreateBusy(true)
    try {
      const body = {
        name: newName.trim(),
        email: newEmail.trim(),
        ...(newPassword.trim() ? { password: newPassword.trim() } : {}),
      }
      const out = await createPractitionerPatient(body)
      const pwdNote = newPassword.trim()
        ? 'Password was set as you entered; share it securely with the patient if they did not receive email.'
        : 'A temporary password was emailed to the patient when email delivery succeeded.'
      setCreateOk({
        message: `Patient ${out.name} created.`,
        emailSent: out.emailSent,
        pwdNote,
      })
      setNewName('')
      setNewEmail('')
      setNewPassword('')
      await load(query.trim(), 1)
    } catch (e) {
      setCreateError(e)
    } finally {
      setCreateBusy(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 border-b border-border/60 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Patients</h1>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Patients linked to your practice. Add new accounts, search the roster, and open the catalog on someone&apos;s
            behalf.
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
        <CardHeader className="border-b border-border/60 bg-muted/30 pb-4">
          <CardTitle className="text-base">Add patient</CardTitle>
          <CardDescription>
            Creates a patient user linked to your practice and sends account details by email when email is configured.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {createOk ? (
            <Alert className="mb-4">
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>
                {createOk.message}{' '}
                {createOk.emailSent ? 'Welcome email sent.' : 'Welcome email was not sent (check server logs / email config).'}{' '}
                {createOk.pwdNote}
              </AlertDescription>
            </Alert>
          ) : null}
          {createError ? (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Could not create patient</AlertTitle>
              <AlertDescription>{createError.message}</AlertDescription>
            </Alert>
          ) : null}
          <form onSubmit={onCreatePatient} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="np-name">Full name</Label>
              <Input
                id="np-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="np-email">Email</Label>
              <Input
                id="np-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2 sm:col-span-2 lg:col-span-1">
              <Label htmlFor="np-pw">Password (optional)</Label>
              <Input
                id="np-pw"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Leave blank to auto-generate"
                autoComplete="new-password"
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={createBusy} className="w-full sm:w-auto">
                {createBusy ? 'Creating…' : 'Create patient'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

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
                    <span className="tabular-nums">{total}</span> patient{total === 1 ? '' : 's'}
                    {query.trim() ? ' match your search' : ' linked to you'}
                    {total > 0 ? (
                      <>
                        {' '}
                        · showing <span className="tabular-nums">{rangeStart}</span>–
                        <span className="tabular-nums">{rangeEnd}</span>
                      </>
                    ) : null}
                  </>
                )}
              </CardDescription>
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
              No patients found{query.trim() ? ' for this search' : ''}. Add a patient with the form above.
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

      <p className="text-xs leading-relaxed text-muted-foreground">
        Patient portal shared carts still follow the patient&apos;s <strong>primary clinic</strong> link when one is set.
        Orders you create are always under your practitioner account.
      </p>
    </div>
  )
}
