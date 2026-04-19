import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { addCartItem, getProducts } from '../../api/client'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function PatientCatalog() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    ;(async () => {
      try {
        setLoading(true)
        const ps = await getProducts()
        setProducts(ps)
      } catch (e) {
        setError(e)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const add = async (p) => {
    try {
      setError(null)
      setToast(null)
      await addCartItem({ productId: p.id, quantity: 1 })
      setToast(`Added “${p.name}” to your cart`)
    } catch (e) {
      setError(e)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Patient · Catalog</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Add lab tests and supplements to your shared cart. Your practitioner&apos;s suggestions appear separately on the{' '}
            <Link to="/patient/cart" className="font-medium text-primary underline-offset-4 hover:underline">
              cart
            </Link>{' '}
            page.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" asChild>
          <Link to="/patient/cart">View cart</Link>
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : null}
      {toast ? (
        <Alert>
          <AlertTitle>Cart</AlertTitle>
          <AlertDescription>{toast}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="border-border/80 shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Products ({products.length})</CardTitle>
          <CardDescription>Items are added to your cart as &quot;You&quot;.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {products.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3 last:border-0 last:pb-0"
                >
                  <span>
                    {p.name} · {p.category} · your price ${Number(p.patient_price ?? p.price ?? 0).toFixed(2)}
                  </span>
                  <Button type="button" size="sm" variant="outline" onClick={() => add(p)}>
                    Add to my cart
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
