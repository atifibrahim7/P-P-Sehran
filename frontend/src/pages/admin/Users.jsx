import { useEffect, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { createUser, deletePatientByUserId, getUser, getUsersPage, updateUser } from '../../api/client'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

function emptyPractitionerProfileForm() {
  return {
    title: '',
    forenames: '',
    surname: '',
    dateOfBirth: '',
    gender: 'Unknown',
    policyNumber: '',
    clientReference2: '',
    nationalInsuranceNumber: '',
    smokerStatus: 'Unknown',
    addresses: [
      {
        addressTypeId: '0',
        addressLine1: '',
        addressLine2: '',
        addressLine3: '',
        city: '',
        county: '',
        country: '',
        postcode: '',
        isPreferred: true,
      },
    ],
    contacts: [{ phoneNumber: '', phoneType: 'Mobile' }],
  }
}

function dbGenderToForm(g) {
  if (g === 'MALE') return 'Male'
  if (g === 'FEMALE') return 'Female'
  return 'Unknown'
}

function dbSmokerToForm(s) {
  if (s === 'NON_SMOKER') return 'NonSmoker'
  if (s === 'SMOKER') return 'Smoker'
  return 'Unknown'
}

function dbPhoneTypeToForm(t) {
  if (t === 'HOME') return 'Home'
  if (t === 'WORK') return 'Work'
  if (t === 'OTHER') return 'Other'
  return 'Mobile'
}

function buildPractitionerProfilePayload(pf) {
  return {
    ...(pf.title.trim() ? { title: pf.title.trim() } : {}),
    forenames: pf.forenames.trim(),
    surname: pf.surname.trim(),
    dateOfBirth: pf.dateOfBirth.trim(),
    gender: pf.gender,
    policyNumber: pf.policyNumber.trim(),
    ...(pf.clientReference2.trim() ? { clientReference2: pf.clientReference2.trim() } : {}),
    ...(pf.nationalInsuranceNumber.trim()
      ? { nationalInsuranceNumber: pf.nationalInsuranceNumber.trim() }
      : {}),
    smokerStatus: pf.smokerStatus,
    addresses: pf.addresses.map((address) => ({
      addressTypeId: Number(address.addressTypeId),
      addressLine1: address.addressLine1.trim(),
      ...(address.addressLine2.trim() ? { addressLine2: address.addressLine2.trim() } : {}),
      ...(address.addressLine3.trim() ? { addressLine3: address.addressLine3.trim() } : {}),
      city: address.city.trim(),
      ...(address.county.trim() ? { county: address.county.trim() } : {}),
      country: address.country.trim(),
      postcode: address.postcode.trim(),
      isPreferred: Boolean(address.isPreferred),
    })),
    contacts: pf.contacts.map((contact) => ({
      phoneNumber: contact.phoneNumber.trim(),
      phoneType: contact.phoneType,
    })),
  }
}

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', role: 'patient', password: '' })
  const [pracForm, setPracForm] = useState(() => emptyPractitionerProfileForm())
  const [profileLoading, setProfileLoading] = useState(false)
  const [deletingUserId, setDeletingUserId] = useState(null)

  const load = async () => {
    try {
      setLoading(true)
      const data = await getUsersPage({ page: pagination.page, pageSize: pagination.pageSize })
      setUsers(data.items || [])
      setPagination(data.pagination)
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, pagination.pageSize])

  useEffect(() => {
    if (!dialogOpen || !editingId || form.role !== 'practitioner') return undefined
    let cancelled = false
    ;(async () => {
      try {
        setProfileLoading(true)
        const u = await getUser(editingId)
        if (cancelled) return
        setForm((prev) => ({ ...prev, name: u.name, email: u.email, role: u.role }))
        if (u.practitionerProfile) {
          const pp = u.practitionerProfile
          setPracForm({
            title: pp.title || '',
            forenames: pp.forenames || '',
            surname: pp.surname || '',
            dateOfBirth: (pp.dateOfBirth || '').slice(0, 10),
            gender: dbGenderToForm(pp.gender),
            policyNumber: pp.policyNumber || '',
            clientReference2: pp.clientReference2 || '',
            nationalInsuranceNumber: pp.nationalInsuranceNumber || '',
            smokerStatus: dbSmokerToForm(pp.smokerStatus),
            addresses:
              pp.addresses?.length > 0
                ? pp.addresses.map((a) => ({
                    addressTypeId: String(a.addressTypeId),
                    addressLine1: a.addressLine1 || '',
                    addressLine2: a.addressLine2 || '',
                    addressLine3: a.addressLine3 || '',
                    city: a.city || '',
                    county: a.county || '',
                    country: a.country || '',
                    postcode: a.postcode || '',
                    isPreferred: !!a.isPreferred,
                  }))
                : emptyPractitionerProfileForm().addresses,
            contacts:
              pp.contacts?.length > 0
                ? pp.contacts.map((c) => ({
                    phoneNumber: c.phoneNumber || '',
                    phoneType: dbPhoneTypeToForm(c.phoneType),
                  }))
                : emptyPractitionerProfileForm().contacts,
          })
        } else {
          setPracForm(emptyPractitionerProfileForm())
        }
      } catch (e) {
        if (!cancelled) setError(e)
      } finally {
        if (!cancelled) setProfileLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [dialogOpen, editingId, form.role])

  const submit = async (e) => {
    e.preventDefault()
    try {
      setError(null)
      if (form.role === 'practitioner') {
        if (!editingId && !form.password?.trim()) {
          setError(new Error('Password is required for new users'))
          return
        }
        const payloadBase = {
          name: form.name,
          email: form.email,
          role: form.role,
          ...(form.password?.trim() ? { password: form.password } : {}),
          practitionerProfile: buildPractitionerProfilePayload(pracForm),
        }
        if (editingId) {
          await updateUser(editingId, payloadBase)
        } else {
          if (!form.password?.trim()) {
            setError(new Error('Password is required'))
            return
          }
          await createUser({
            name: form.name,
            email: form.email,
            role: form.role,
            password: form.password,
            practitionerProfile: buildPractitionerProfilePayload(pracForm),
          })
        }
      } else if (editingId) {
        await updateUser(editingId, {
          name: form.name,
          email: form.email,
          role: form.role,
          password: form.password || undefined,
        })
      } else {
        await createUser(form)
      }
      await load()
      setDialogOpen(false)
      setEditingId(null)
      setForm({ name: '', email: '', role: 'patient', password: '' })
      setPracForm(emptyPractitionerProfileForm())
    } catch (err) {
      setError(err)
    }
  }

  const handleDeletePatient = async (user) => {
    const confirmed = window.confirm(`Soft-delete patient ${user.name} (${user.email})?`)
    if (!confirmed) return

    try {
      setError(null)
      setDeletingUserId(user.id)
      await deletePatientByUserId(user.id)
      await load()
    } catch (err) {
      setError(err)
    } finally {
      setDeletingUserId(null)
    }
  }

  const updateAddress = (index, patch) => {
    setPracForm((prev) => ({
      ...prev,
      addresses: prev.addresses.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }))
  }

  const updateContact = (index, patch) => {
    setPracForm((prev) => ({
      ...prev,
      contacts: prev.contacts.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }))
  }

  const isPractitioner = form.role === 'practitioner'

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Admin · Users</h1>
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="border-border/80 shadow-none">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base font-medium">Users</CardTitle>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setEditingId(null)
              setForm({ name: '', email: '', role: 'patient', password: '' })
              setPracForm(emptyPractitionerProfileForm())
              setDialogOpen(true)
            }}
          >
            Create new
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>{u.name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{u.role}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Edit user"
                        onClick={() => {
                          setEditingId(u.id)
                          setForm({ name: u.name, email: u.email, role: u.role, password: '' })
                          setPracForm(emptyPractitionerProfileForm())
                          setDialogOpen(true)
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      {u.role === 'patient' ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Delete patient"
                          className="text-destructive hover:text-destructive"
                          disabled={deletingUserId === u.id}
                          onClick={() => handleDeletePatient(u)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Rows per page</span>
              <Select
                value={String(pagination.pageSize)}
                onValueChange={(v) => setPagination((prev) => ({ ...prev, page: 1, pageSize: Number(v) }))}
              >
                <SelectTrigger size="sm" className="w-[72px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[5, 10, 25, 50].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                {pagination.total ? (
                  <>
                    Page {pagination.page} of {pagination.totalPages}
                  </>
                ) : (
                  'No rows'
                )}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) {
            setEditingId(null)
            setForm({ name: '', email: '', role: 'patient', password: '' })
            setPracForm(emptyPractitionerProfileForm())
          }
        }}
      >
        <DialogContent className={isPractitioner ? 'max-h-[90vh] overflow-y-auto sm:max-w-3xl' : 'sm:max-w-md'} showCloseButton>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Update user' : 'Create user'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            {profileLoading && editingId && isPractitioner ? (
              <p className="text-sm text-muted-foreground">Loading practitioner profile…</p>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="u-name">Name</Label>
              <Input id="u-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="u-email">Email</Label>
              <Input
                id="u-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={form.role}
                onValueChange={(v) => {
                  setForm((f) => ({ ...f, role: v }))
                  if (v === 'practitioner') {
                    setPracForm(emptyPractitionerProfileForm())
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="practitioner">Practitioner</SelectItem>
                  <SelectItem value="patient">Patient</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="u-password">{editingId ? 'Password (optional)' : 'Password'}</Label>
              <Input
                id="u-password"
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                required={!editingId}
              />
              {form.role === 'practitioner' && !editingId ? (
                <p className="text-xs text-muted-foreground">Required for new accounts.</p>
              ) : null}
            </div>

            {isPractitioner ? (
              <div className="space-y-4 border-t border-border pt-4">
                <p className="text-sm font-medium text-foreground">Practitioner profile (Inuvi)</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Title (optional)</Label>
                    <Input value={pracForm.title} onChange={(e) => setPracForm((p) => ({ ...p, title: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Date of birth</Label>
                    <Input
                      type="date"
                      value={pracForm.dateOfBirth}
                      onChange={(e) => setPracForm((p) => ({ ...p, dateOfBirth: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Forenames</Label>
                    <Input
                      value={pracForm.forenames}
                      onChange={(e) => setPracForm((p) => ({ ...p, forenames: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Surname</Label>
                    <Input
                      value={pracForm.surname}
                      onChange={(e) => setPracForm((p) => ({ ...p, surname: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Gender</Label>
                    <Select value={pracForm.gender} onValueChange={(v) => setPracForm((p) => ({ ...p, gender: v }))}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Unknown">Unknown</SelectItem>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Smoker</Label>
                    <Select value={pracForm.smokerStatus} onValueChange={(v) => setPracForm((p) => ({ ...p, smokerStatus: v }))}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Unknown">Unknown</SelectItem>
                        <SelectItem value="NonSmoker">Non-smoker</SelectItem>
                        <SelectItem value="Smoker">Smoker</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Policy number</Label>
                    <Input
                      value={pracForm.policyNumber}
                      onChange={(e) => setPracForm((p) => ({ ...p, policyNumber: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Client ref 2 (optional)</Label>
                    <Input
                      value={pracForm.clientReference2}
                      onChange={(e) => setPracForm((p) => ({ ...p, clientReference2: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>National Insurance (optional)</Label>
                    <Input
                      value={pracForm.nationalInsuranceNumber}
                      onChange={(e) => setPracForm((p) => ({ ...p, nationalInsuranceNumber: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Addresses</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPracForm((p) => ({
                          ...p,
                          addresses: [
                            ...p.addresses,
                            {
                              addressTypeId: '0',
                              addressLine1: '',
                              addressLine2: '',
                              addressLine3: '',
                              city: '',
                              county: '',
                              country: '',
                              postcode: '',
                              isPreferred: false,
                            },
                          ],
                        }))
                      }
                    >
                      Add address
                    </Button>
                  </div>
                  {pracForm.addresses.map((addr, i) => (
                    <div key={i} className="grid gap-2 rounded-md border border-border/80 p-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Type</Label>
                        <Select
                          value={String(addr.addressTypeId)}
                          onValueChange={(v) => updateAddress(i, { addressTypeId: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">0</SelectItem>
                            <SelectItem value="1">1</SelectItem>
                            <SelectItem value="2">2</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <Label className="text-xs">Line 1</Label>
                        <Input value={addr.addressLine1} onChange={(e) => updateAddress(i, { addressLine1: e.target.value })} />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <Label className="text-xs">City / Country / Postcode</Label>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Input placeholder="City" value={addr.city} onChange={(e) => updateAddress(i, { city: e.target.value })} />
                          <Input
                            placeholder="Country"
                            value={addr.country}
                            onChange={(e) => updateAddress(i, { country: e.target.value })}
                          />
                          <Input
                            placeholder="Postcode"
                            value={addr.postcode}
                            onChange={(e) => updateAddress(i, { postcode: e.target.value })}
                          />
                        </div>
                      </div>
                      <label className="flex items-center gap-2 text-xs sm:col-span-2">
                        <input
                          type="checkbox"
                          checked={addr.isPreferred}
                          onChange={(e) => updateAddress(i, { isPreferred: e.target.checked })}
                        />
                        Preferred
                      </label>
                      {pracForm.addresses.length > 1 ? (
                        <Button type="button" variant="ghost" size="sm" onClick={() => setPracForm((p) => ({ ...p, addresses: p.addresses.filter((_, j) => j !== i) }))}>
                          Remove
                        </Button>
                      ) : null}
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Phone contacts</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPracForm((p) => ({
                          ...p,
                          contacts: [...p.contacts, { phoneNumber: '', phoneType: 'Mobile' }],
                        }))
                      }
                    >
                      Add phone
                    </Button>
                  </div>
                  {pracForm.contacts.map((c, i) => (
                    <div key={i} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">Number</Label>
                        <Input value={c.phoneNumber} onChange={(e) => updateContact(i, { phoneNumber: e.target.value })} />
                      </div>
                      <Select value={c.phoneType} onValueChange={(v) => updateContact(i, { phoneType: v })}>
                        <SelectTrigger className="sm:w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Mobile">Mobile</SelectItem>
                          <SelectItem value="Home">Home</SelectItem>
                          <SelectItem value="Work">Work</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      {pracForm.contacts.length > 1 ? (
                        <Button type="button" variant="ghost" size="sm" onClick={() => setPracForm((p) => ({ ...p, contacts: p.contacts.filter((_, j) => j !== i) }))}>
                          Remove
                        </Button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={profileLoading && editingId && isPractitioner}>
                {editingId ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
