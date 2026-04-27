import { useEffect, useState } from 'react'
import { Building2, Package } from 'lucide-react'
import { getProductsPage, getVendors } from '../../../api/client'
import PatientAddToCartDialog from '../../../components/patient/PatientAddToCartDialog.jsx'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ProductSwipeGallery } from '@/components/ProductSwipeGallery'
import { cn } from '@/lib/utils'

export default function PatientCatalogBrowse({ category }) {
  const vendorListType = category === 'supplement' ? 'supplement' : 'lab'
  const categoryLabel = category === 'supplement' ? 'supplements' : 'lab tests'

  const [products, setProducts] = useState([])
  const [vendors, setVendors] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pageSize: 12, total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogProduct, setDialogProduct] = useState(null)
  const [q, setQ] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [vendorFilter, setVendorFilter] = useState('all')
  const [sort, setSort] = useState('name_asc')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(q.trim()), 280)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }))
  }, [category, searchTerm, vendorFilter, sort, minPrice, maxPrice])

  const loadProducts = async () => {
    setLoading(true)
    try {
      setError(null)
      const [vs, ps] = await Promise.all([
        getVendors({ type: vendorListType }),
        getProductsPage({
          type: category === 'lab_test' ? 'lab_test' : 'supplement',
          page: pagination.page,
          pageSize: pagination.pageSize,
          ...(searchTerm ? { q: searchTerm } : {}),
          ...(vendorFilter !== 'all' ? { vendorId: Number(vendorFilter) } : {}),
          ...(minPrice !== '' ? { minPrice } : {}),
          ...(maxPrice !== '' ? { maxPrice } : {}),
          sort,
        }),
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
    loadProducts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, pagination.page, pagination.pageSize, vendorListType, searchTerm, vendorFilter, sort, minPrice, maxPrice])

  const openAdd = (p) => {
    setDialogProduct(p)
    setDialogOpen(true)
  }

  return (
    <div className="space-y-8">
      <PatientAddToCartDialog
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v)
          if (!v) setDialogProduct(null)
        }}
        product={dialogProduct}
      />

      <div>
        <h2 className="text-lg font-semibold tracking-tight capitalize">{categoryLabel}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{pagination.total} product{pagination.total === 1 ? '' : 's'}</p>
      </div>

      <Card className="border-border/80 shadow-sm">
        <CardContent className="grid gap-3 pt-4 sm:grid-cols-2 lg:grid-cols-6">
          <div className="sm:col-span-2 lg:col-span-2">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Search</label>
            <input
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              placeholder="SKU or name"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Vendor</label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
            >
              <option value="all">All</option>
              {vendors.map((v) => (
                <option key={v.id} value={String(v.id)}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Sort</label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="name_asc">Name A-Z</option>
              <option value="name_desc">Name Z-A</option>
              <option value="price_asc">Price Low-High</option>
              <option value="price_desc">Price High-Low</option>
              <option value="newest">Newest</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Min price</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Max price</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[360px] rounded-xl" />
          ))}
        </div>
      ) : !products.length ? (
        <Card className="border-dashed border-border/80 shadow-none">
          <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Package className="size-12 text-muted-foreground/50" />
            <p className="font-medium text-foreground">No {categoryLabel} yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">Ask an admin to add products in this category.</p>
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
            return (
              <Card
                key={p.id}
                className={cn(
                  'flex flex-col overflow-hidden border-border/80 py-0 shadow-md transition-shadow hover:shadow-lg',
                )}
              >
                <div className="relative aspect-[4/3] bg-muted">
                  <ProductSwipeGallery
                    urls={
                      Array.isArray(p.imageUrls) && p.imageUrls.length
                        ? p.imageUrls
                        : p.imageLink
                          ? [p.imageLink]
                          : []
                    }
                    alt={p.name}
                    heightClass="h-[220px]"
                  />
                </div>
                <CardHeader className="gap-1 pb-2 pt-4">
                  <CardTitle className="line-clamp-2 text-base leading-snug">{p.name}</CardTitle>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-primary">{p.sku}</p>
                  {p.description ? (
                    <CardDescription className="line-clamp-2 text-xs leading-relaxed">{p.description}</CardDescription>
                  ) : (
                    <CardDescription className="text-xs italic opacity-70">No description</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3 pb-3 pt-0">
                  <div className="flex items-start justify-between gap-2 border-t border-border/60 pt-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Your price</p>
                      <p className="font-semibold tabular-nums text-primary">${pp}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Vendor</p>
                      <p
                        className="flex items-center justify-end gap-1 text-xs font-medium text-foreground"
                        title={vendorName}
                      >
                        <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="line-clamp-2 max-w-[7rem] break-words">{vendorName}</span>
                      </p>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="mt-auto border-t border-border/60 bg-muted/30 px-4 py-3">
                  <Button type="button" className="w-full" size="sm" onClick={() => openAdd(p)}>
                    Add to cart
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
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={String(pagination.pageSize)}
              onChange={(e) => setPagination((prev) => ({ ...prev, page: 1, pageSize: Number(e.target.value) }))}
            >
              {[8, 12, 24, 48].map((n) => (
                <option key={n} value={String(n)}>
                  {n}
                </option>
              ))}
            </select>
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
    </div>
  )
}
