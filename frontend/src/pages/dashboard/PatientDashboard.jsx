import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, FlaskConical, ShoppingCart, Sparkles, UserRound } from 'lucide-react'
import { api, getCart, getOrders } from '../../api/client'
import KpiCard from '../../components/KpiCard.jsx'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export default function PatientDashboard() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        const [orders, results, cartRes] = await Promise.all([getOrders(), api('/lab/results'), getCart()])
        if (!mounted) return
        const orderList = Array.isArray(orders) ? orders : []
        const openOrders = orderList.filter((o) => String(o.state).toLowerCase() !== 'paid').length
        const cartItems = cartRes?.cart?.items?.length ?? 0
        const suggested =
          cartRes?.cart?.items?.filter((i) => i.addedBy === 'practitioner').length ?? 0
        const mine = cartRes?.cart?.items?.filter((i) => i.addedBy === 'patient').length ?? 0
        setData({
          orders: orderList.length,
          openOrders,
          results: Array.isArray(results) ? results.length : 0,
          cartItems,
          suggested,
          mine,
          noCart: cartRes?.cart === null && cartRes?.message,
        })
      } catch (e) {
        if (mounted) setError(e)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  const kpis = useMemo(() => {
    if (!data) return []
    return [
      {
        title: 'Cart',
        value: loading ? '—' : data.noCart ? '—' : data.cartItems,
        subtitle: data.noCart
          ? 'Link a practitioner to use shared cart'
          : `${data.suggested} suggested · ${data.mine} added by you`,
        icon: ShoppingCart,
        colorKey: 'primary',
      },
      { title: 'My orders', value: loading ? '—' : data.orders, subtitle: `${data.openOrders} awaiting payment or in progress`, icon: ClipboardList, colorKey: 'primary' },
      { title: 'Test results', value: loading ? '—' : data.results, subtitle: 'Lab reports available', icon: FlaskConical, colorKey: 'secondary' },
      { title: 'Recommendations', value: '—', subtitle: 'From your practitioner (see quick links)', icon: Sparkles, colorKey: 'primary' },
      { title: 'Profile', value: '—', subtitle: 'Account & contact (see quick links)', icon: UserRound, colorKey: 'secondary' },
    ]
  }, [data, loading])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Patient dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your orders, lab results, and care recommendations in one place.</p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.title}>
            {loading && !data ? <Skeleton className="h-[132px] rounded-xl" /> : <KpiCard {...k} />}
          </div>
        ))}
      </div>

      {!loading && data && !data.noCart ? (
        <Card className="border-primary/25 bg-gradient-to-br from-primary/5 to-transparent shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Your shared cart</CardTitle>
            <p className="text-sm text-muted-foreground">
              {data.cartItems} item{data.cartItems === 1 ? '' : 's'} · {data.suggested} from practitioner · {data.mine}{' '}
              from you
            </p>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link to="/patient/cart" className={cn(buttonVariants({ size: 'sm' }))}>
              Open cart
            </Link>
            <Link to="/patient/catalog" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
              Browse catalog
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {!loading && data?.noCart ? (
        <Alert>
          <AlertTitle>Cart not active</AlertTitle>
          <AlertDescription>
            Your account needs a linked practitioner before you can share a cart. Contact your clinic administrator.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card className="border-border/80 shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Quick links</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link to="/patient/cart" className={cn(buttonVariants({ size: 'sm' }))}>
            Cart
          </Link>
          <Link to="/patient/catalog" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
            Catalog
          </Link>
          <Link to="/patient/recommendations" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
            Recommendations
          </Link>
          <Link to="/patient/orders" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
            Orders
          </Link>
          <Link to="/patient/test-results" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
            Test results
          </Link>
          <Link to="/patient/profile" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
            Profile
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
