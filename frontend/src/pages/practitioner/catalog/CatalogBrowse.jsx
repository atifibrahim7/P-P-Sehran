import { useEffect, useState } from 'react'
import { Building2, Package } from 'lucide-react'
import { getProductsPage, getVendors } from '../../../api/client'
import AddToCartDialog from '../../../components/practitioner/AddToCartDialog.jsx'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export default function PractitionerCatalogBrowse({ category }) {
  const vendorListType = category === 'supplement' ? 'supplement' : 'lab'
  const categoryLabel = category === 'supplement' ? 'supplements' : 'lab tests'

  const [products, setProducts] = useState([])
  const [vendors, setVendors] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pageSize: 12, total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogProduct, setDialogProduct] = useState(null)

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
  }, [category, pagination.page, pagination.pageSize, vendorListType])

  const openAdd = (p) => {
    setDialogProduct(p)
    setDialogOpen(true)
  }

  return (
    <div className="space-y-8">
      <AddToCartDialog
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v)
          if (!v) setDialogProduct(null)
        }}
        product={dialogProduct}
      />

      <div>
        <h2 className="text-lg font-semibold tracking-tight capitalize">{categoryLabel}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {pagination.total} product{pagination.total === 1 ? '' : 's'} — select a product to choose quantity, recipient,
          and add to the right cart.
        </p>
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
                    <img src={p.imageLink} alt="" className="h-[220px] w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                      <Package className="size-14 opacity-35" strokeWidth={1.25} />
                      <span className="text-xs font-medium opacity-60">No image</span>
                    </div>
                  )}
                </div>
                <CardHeader className="gap-1 pb-2 pt-4">
                  <CardTitle className="line-clamp-2 text-base leading-snug">{p.name}</CardTitle>
                  {p.description ? (
                    <CardDescription className="line-clamp-2 text-xs leading-relaxed">{p.description}</CardDescription>
                  ) : (
                    <CardDescription className="text-xs italic opacity-70">No description</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3 pb-3 pt-0">
                  <div className="flex items-start justify-between gap-2 border-t border-border/60 pt-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Prices</p>
                      <p className="font-semibold tabular-nums text-primary">
                        Patient ${pp}
                        <span className="mx-1 text-muted-foreground">·</span>
                        Practitioner ${pr}
                      </p>
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
