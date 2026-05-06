import { useEffect, useState } from 'react'
import { Pencil } from 'lucide-react'
import { createVendor, getVendorsPage, updateVendor } from '../../api/client'
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

function vendorTypeLabel(type) {
  if (type === 'both') return 'Lab & supplement'
  if (type === 'lab') return 'Lab'
  if (type === 'supplement') return 'Supplement'
  return type
}

function capsToApiType(lab, supplement) {
  if (lab && supplement) return 'both'
  if (lab) return 'lab'
  if (supplement) return 'supplement'
  return null
}

function apiTypeToCaps(type) {
  if (type === 'both') return { lab: true, supplement: true }
  if (type === 'lab') return { lab: true, supplement: false }
  if (type === 'supplement') return { lab: false, supplement: true }
  return { lab: true, supplement: false }
}

export default function AdminVendors() {
  const [vendors, setVendors] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ name: '', lab: true, supplement: false })

  const load = async () => {
    try {
      setLoading(true)
      const vs = await getVendorsPage({ page: pagination.page, pageSize: pagination.pageSize })
      setVendors(vs.items || [])
      setPagination(vs.pagination)
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

  const submit = async (e) => {
    e.preventDefault()
    const apiType = capsToApiType(form.lab, form.supplement)
    if (!apiType) {
      setError(Object.assign(new Error('Select at least one: Lab or Supplement'), { name: 'ValidationError' }))
      return
    }
    try {
      setError(null)
      if (editingId) {
        await updateVendor(editingId, { name: form.name, type: apiType })
      } else {
        await createVendor({ name: form.name, type: apiType })
      }
      await load()
      setEditingId(null)
      setDialogOpen(false)
      setForm({ name: '', lab: true, supplement: false })
    } catch (e) {
      setError(e)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Admin · Vendors</h1>
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="border-border/80 shadow-none">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base font-medium">Vendors</CardTitle>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setEditingId(null)
              setForm({ name: '', lab: true, supplement: false })
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
                <TableHead>Capabilities</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : (
                vendors.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>{v.name}</TableCell>
                    <TableCell>{vendorTypeLabel(v.type)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Edit vendor"
                        onClick={() => {
                          setEditingId(v.id)
                          setForm({ name: v.name, ...apiTypeToCaps(v.type) })
                          setDialogOpen(true)
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
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
            setForm({ name: '', lab: true, supplement: false })
          }
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Update vendor' : 'Create vendor'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="v-name">Name</Label>
              <Input id="v-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium leading-none">Capabilities</legend>
              <p className="text-xs text-muted-foreground">A vendor can supply lab tests, supplements, or both.</p>
              <div className="flex flex-col gap-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-input accent-primary"
                    checked={form.lab}
                    onChange={(e) => setForm((f) => ({ ...f, lab: e.target.checked }))}
                  />
                  Lab
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-input accent-primary"
                    checked={form.supplement}
                    onChange={(e) => setForm((f) => ({ ...f, supplement: e.target.checked }))}
                  />
                  Supplement
                </label>
              </div>
            </fieldset>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editingId ? 'Update' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
