import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { checkoutCart, getCart, removeCartItem, updateCartItem } from '../../api/client'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

export default function PatientCart() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await getCart()
      setData(res)
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const cart = data?.cart
  const items = cart?.items || []
  const suggested = useMemo(() => items.filter((i) => i.addedBy === 'practitioner'), [items])
  const mine = useMemo(() => items.filter((i) => i.addedBy === 'patient'), [items])

  const totals = useMemo(() => {
    let tp = 0
    for (const it of items) {
      const p = it.product
      const q = it.quantity || 1
      tp += Number(p?.patient_price ?? p?.price ?? 0) * q
    }
    return tp
  }, [items])

  const setQty = async (itemId, quantity) => {
    try {
      setError(null)
      const updated = await updateCartItem(itemId, quantity)
      setData({ cart: updated })
    } catch (e) {
      setError(e)
    }
  }

  const remove = async (itemId) => {
    try {
      setError(null)
      const updated = await removeCartItem(itemId)
      setData({ cart: updated })
    } catch (e) {
      setError(e)
    }
  }

  const pay = async () => {
    try {
      setError(null)
      setMessage(null)
      const out = await checkoutCart({})
      await load()
      if (out?.order?.id) navigate(`/orders/${out.order.id}`)
      else setMessage('Order created. You can complete payment from the order detail page.')
    } catch (e) {
      setError(e)
    }
  }

  if (data?.cart === null && data?.message) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Patient · Cart</h1>
        <Alert>
          <AlertTitle>Cart unavailable</AlertTitle>
          <AlertDescription>{data.message}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Patient · Cart</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your practitioner may suggest items here. You can add your own from the{' '}
            <Link to="/patient/catalog" className="font-medium text-primary underline-offset-4 hover:underline">
              catalog
            </Link>
            .
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" asChild>
          <Link to="/patient/catalog">Browse catalog</Link>
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : null}
      {message ? (
        <Alert>
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="border-border/80 shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Shared cart {loading ? '…' : `(${items.length} items)`}</CardTitle>
          <CardDescription>
            Suggested items come from your practitioner. Items you add are labeled &quot;You&quot;.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <>
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-primary">Suggested by your practitioner</h2>
                <ItemList items={suggested} onQty={setQty} onRemove={remove} />
                {!suggested.length ? <p className="text-sm text-muted-foreground">None yet.</p> : null}
              </section>
              <Separator />
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-foreground">Added by you</h2>
                <ItemList items={mine} onQty={setQty} onRemove={remove} />
                {!mine.length ? (
                  <p className="text-sm text-muted-foreground">Nothing added yet — open the catalog to add products.</p>
                ) : null}
              </section>
            </>
          )}

          {items.length > 0 ? (
            <>
              <Separator />
              <p className="text-lg font-semibold tabular-nums">Your total: ${totals.toFixed(2)}</p>
              <Button type="button" onClick={pay}>
                Create order &amp; go to payment
              </Button>
              <p className="text-xs text-muted-foreground">Creates an order from this cart; you can pay from the order screen.</p>
            </>
          ) : !loading ? (
            <Button type="button" variant="secondary" asChild>
              <Link to="/patient/catalog">Shop the catalog</Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

function ItemList({ items, onQty, onRemove }) {
  return (
    <ul className="space-y-3">
      {items.map((it) => (
        <li
          key={it.id}
          className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{it.product?.name}</span>
              <Badge variant={it.addedBy === 'practitioner' ? 'secondary' : 'default'}>
                {it.addedBy === 'practitioner' ? 'Practitioner' : 'You'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              ${Number(it.product?.patient_price ?? it.product?.price ?? 0).toFixed(2)} each
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1 text-sm">
              Qty
              <input
                type="number"
                min={1}
                className="w-16 rounded border border-input bg-background px-2 py-1 text-sm"
                value={it.quantity}
                onChange={(e) => onQty(it.id, Math.max(1, Number(e.target.value) || 1))}
              />
            </label>
            <Button type="button" size="sm" variant="outline" onClick={() => onRemove(it.id)}>
              Remove
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )
}
