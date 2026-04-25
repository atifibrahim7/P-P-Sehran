import { useEffect, useMemo, useState } from 'react'
import { Building2, Package, Pencil, Trash2 } from 'lucide-react'
import { createProduct, deleteProduct, getProductsPage, getVendors, updateProduct, uploadProductImage } from '../../api/client'
import ImageDropzone from '@/components/ImageDropzone'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

function emptyForm() {
  return {
    sku: '',
    name: '',
    description: '',
    patient_price: '',
    practitioner_price: '',
    imageLink: '',
    vendorId: '',
    vendorLabel: '',
  }
}

export default function ProductManagement({ category }) {
  const [vendors, setVendors] = useState([])
  const [products, setProducts] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const isEdit = Boolean(editingId)
  const title = category === 'supplement' ? 'Admin · Supplements' : 'Admin · Lab Tests'
  const categoryLabel = category === 'supplement' ? 'supplements' : 'lab tests'
  const vendorListType = category === 'supplement' ? 'supplement' : 'lab'

  const selectVendors = useMemo(() => {
    const vid = form.vendorId != null && form.vendorId !== '' ? String(form.vendorId) : ''
    if (!vid) return vendors
    if (vendors.some((v) => String(v.id) === vid)) return vendors
    const label = form.vendorLabel || `Vendor #${vid}`
    const nid = Number(vid)
    return [...vendors, { id: Number.isFinite(nid) ? nid : vid, name: label }]
  }, [vendors, form.vendorId, form.vendorLabel])

  const selectedVendorDisplay = useMemo(() => {
    if (!form.vendorId) return null
    const id = String(form.vendorId)
    return selectVendors.find((v) => String(v.id) === id)?.name ?? form.vendorLabel ?? null
  }, [form.vendorId, form.vendorLabel, selectVendors])

  const isValid = useMemo(() => {
    const pp = Number(form.patient_price)
    const pr = Number(form.practitioner_price)
    const base =
      form.sku.trim() &&
      form.name.trim() &&
      form.patient_price !== '' &&
      form.practitioner_price !== '' &&
      !Number.isNaN(pp) &&
      !Number.isNaN(pr) &&
      pp >= 0 &&
      pr >= 0
    const vendorOk = vendors.length === 0 || Boolean(String(form.vendorId || '').trim())
    return Boolean(base && vendorOk)
  }, [form, vendors.length])

  const load = async () => {
    setLoading(true)
    try {
      const [vs, ps] = await Promise.all([
        getVendors({ type: vendorListType }),
        getProductsPage({ type: category, page: pagination.page, pageSize: pagination.pageSize }),
      ])
      setVendors(vs)
      setProducts(ps.items || [])
      setPagination(ps.pagination)
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, pagination.page, pagination.pageSize, vendorListType])

  const resetForm = () => {
    setEditingId(null)
    setDialogOpen(false)
    setForm(emptyForm())
  }

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    const payload = {
      type: category,
      sku: form.sku.trim().toUpperCase(),
      name: form.name.trim(),
      description: form.description.trim(),
      patient_price: Number(form.patient_price),
      practitioner_price: Number(form.practitioner_price),
      imageLink: form.imageLink.trim() || null,
    }
    if (form.vendorId !== '' && form.vendorId != null) {
      payload.vendorId = Number(form.vendorId)
    }
    try {
      if (isEdit) {
        await updateProduct(editingId, payload)
      } else {
        await createProduct(payload)
      }
      await load()
      resetForm()
    } catch (err) {
      setError(err)
    }
  }

  const startEdit = (product) => {
    setEditingId(product.id)
    setForm({
      sku: product.sku || '',
      name: product.name || '',
      description: product.description || '',
      patient_price:
        product.patient_price != null ? String(product.patient_price) : String(product.price ?? ''),
      practitioner_price:
        product.practitioner_price != null
          ? String(product.practitioner_price)
          : String(product.price ?? ''),
      imageLink: product.imageLink || '',
      vendorId: product.vendorId != null ? String(product.vendorId) : '',
      vendorLabel:
        product.vendorName ??
        vendors.find((v) => Number(v.id) === Number(product.vendorId))?.name ??
        '',
    })
    setDialogOpen(true)
  }

  const remove = async (id) => {
    try {
      setError(null)
      await deleteProduct(id)
      await load()
      if (editingId === id) resetForm()
    } catch (err) {
      setError(err)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse and manage {categoryLabel}. Set patient and practitioner prices — commission on patient-paid orders uses
            the difference (patient minus practitioner). Assign a vendor that supplies this category (including “both”
            vendors).
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className="shrink-0"
          onClick={() => {
            setEditingId(null)
            setForm({
              ...emptyForm(),
              vendorId: vendors.length === 1 ? String(vendors[0].id) : '',
              vendorLabel: vendors.length === 1 ? vendors[0].name : '',
            })
            setDialogOpen(true)
          }}
        >
          Create new
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[340px] rounded-xl" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <Card className="border-dashed border-border/80 shadow-none">
          <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Package className="size-12 text-muted-foreground/50" />
            <p className="font-medium text-foreground">No products yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">Create your first {categoryLabel.slice(0, -1)} to see it here.</p>
            <Button
              type="button"
              size="sm"
              className="mt-2"
              onClick={() => {
                setEditingId(null)
                setForm({
                  ...emptyForm(),
                  vendorId: vendors.length === 1 ? String(vendors[0].id) : '',
                  vendorLabel: vendors.length === 1 ? vendors[0].name : '',
                })
                setDialogOpen(true)
              }}
            >
              Create product
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((p) => {
            const vendorName =
              p.vendorName ??
              vendors.find((v) => Number(v.id) === Number(p.vendorId))?.name ??
              (p.vendorId != null ? `Vendor #${p.vendorId}` : '—')
            const pp = Number(p.patient_price ?? p.price ?? 0).toFixed(2)
            const pr = Number(p.practitioner_price ?? p.price ?? 0).toFixed(2)
            return (
              <Card
                key={p.id}
                className={cn(
                  'flex flex-col overflow-hidden border-border/80 py-0 shadow-md transition-shadow hover:shadow-lg',
                )}
              >
                <div className="relative aspect-[4/3] bg-muted">
                  {p.imageLink ? (
                    <img src={p.imageLink} alt="" className="h-[250px] w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                      <Package className="size-14 opacity-35" strokeWidth={1.25} />
                      <span className="text-xs font-medium opacity-60">No image</span>
                    </div>
                  )}
                </div>
                <CardHeader className="gap-1 pb-2 pt-4">
                  <CardTitle className="line-clamp-2 text-base leading-snug">{p.name}</CardTitle>
                  {p.sku ? (
                    <p className="text-[11px] font-medium uppercase tracking-wide text-primary">{p.sku}</p>
                  ) : null}
                  {p.description ? (
                    <CardDescription className="line-clamp-2 text-xs leading-relaxed">{p.description}</CardDescription>
                  ) : (
                    <CardDescription className="text-xs italic opacity-70">No description</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3 pb-3 pt-0">
                  <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Prices</p>
                      <p className="font-semibold tabular-nums text-primary">
                        Patient ${pp}
                        <span className="mx-1 text-muted-foreground">·</span>
                        Practitioner ${pr}
                      </p>
                    </div>
                    <div >
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Vendor</p>
                      <p className="flex items-center gap-1 text-xs font-medium text-foreground" title={vendorName}>
                        <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="line-clamp-2 break-words ">{vendorName}</span>
                      </p>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="mt-auto flex gap-2 border-t border-border/60 bg-muted/30 px-4 py-3">
                  <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => startEdit(p)}>
                    <Pencil className="mr-1.5 size-3.5" />
                    Edit
                  </Button>
                  <Button type="button" variant="destructive" size="sm" className="flex-1" onClick={() => remove(p.id)}>
                    <Trash2 className="mr-1.5 size-3.5" />
                    Delete
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}

      {!loading && products.length > 0 ? (
        <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Per page</span>
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
          <div className="flex flex-wrap items-center gap-2">
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
              Page {pagination.page} of {pagination.totalPages}
              <span className="hidden sm:inline"> ({pagination.total} total)</span>
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
      ) : null}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) {
            setEditingId(null)
            setForm(emptyForm())
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" showCloseButton>
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Update product' : 'Create product'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                value={form.sku}
                onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value.toUpperCase() }))}
                placeholder="LAB-00123"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Vendor</Label>
              {vendors.length === 0 && !form.vendorId ? (
                <p className="text-xs text-muted-foreground">
                  No vendor supplies this category yet. Create one under Admin · Vendors (choose Lab, Supplement, or
                  both). You can still save; the server will attach a default vendor if one exists.
                </p>
              ) : (
                <Select
                  value={form.vendorId ? String(form.vendorId) : undefined}
                  onValueChange={(v) => {
                    const picked = vendors.find((x) => String(x.id) === v) ?? selectVendors.find((x) => String(x.id) === v)
                    setForm((f) => ({
                      ...f,
                      vendorId: v,
                      vendorLabel: picked?.name ?? f.vendorLabel,
                    }))
                  }}
                >
                  <SelectTrigger className="w-full min-w-0">
                    <SelectValue placeholder="Select vendor">{selectedVendorDisplay}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {selectVendors.map((v) => (
                      <SelectItem key={String(v.id)} value={String(v.id)}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="patient_price">Patient price</Label>
                <Input
                  id="patient_price"
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.patient_price}
                  onChange={(e) => setForm((f) => ({ ...f, patient_price: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="practitioner_price">Practitioner price</Label>
                <Input
                  id="practitioner_price"
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.practitioner_price}
                  onChange={(e) => setForm((f) => ({ ...f, practitioner_price: e.target.value }))}
                  required
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              When a patient pays for an order from their practitioner, commission is based on patient total minus practitioner
              total for each line item.
            </p>
            <div className="space-y-2">
              <Label>Product image</Label>
              <p className="text-xs text-muted-foreground">Upload your product image below.</p>
              <ImageDropzone
                value={form.imageLink}
                onChange={(url) => setForm((f) => ({ ...f, imageLink: url }))}
                onUpload={uploadProductImage}
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="submit" disabled={!isValid}>
                {isEdit ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
