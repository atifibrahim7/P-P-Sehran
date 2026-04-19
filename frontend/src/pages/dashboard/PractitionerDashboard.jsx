import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, ShoppingCart, FlaskConical, Users, Package, Sparkles } from 'lucide-react'
import { api, getOrders } from '../../api/client'
import KpiCard from '../../components/KpiCard.jsx'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export default function PractitionerDashboard() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        const [orders, results] = await Promise.all([getOrders(), api('/lab/results')])
        if (!mounted) return
        const orderList = Array.isArray(orders) ? orders : []
        const cart = JSON.parse(localStorage.getItem('cart_items') || '[]')
        const pending = orderList.filter((o) => String(o.state).toLowerCase() !== 'paid').length
        setData({
          orders: orderList.length,
          pendingOrders: pending,
          results: Array.isArray(results) ? results.length : 0,
          cartItems: Array.isArray(cart) ? cart.length : 0,
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
      { title: 'Orders', value: loading ? '—' : data.orders, subtitle: `${data.pendingOrders} not paid`, icon: ClipboardList, colorKey: 'primary' },
      { title: 'Cart', value: loading ? '—' : data.cartItems, subtitle: 'Items ready to order', icon: ShoppingCart, colorKey: 'primary' },
      { title: 'Lab results', value: loading ? '—' : data.results, subtitle: 'Results on file', icon: FlaskConical, colorKey: 'primary' },
      { title: 'Patients', value: '—', subtitle: 'Patient list (coming soon)', icon: Users, colorKey: 'primary' },
    ]
  }, [data, loading])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Practitioner dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Track orders, cart, and lab activity for your practice.</p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.title} className=" rounded-lg shadow-lg">
            {loading && !data ? <Skeleton className="h-[132px] rounded-xl" /> : <KpiCard {...k} />}
          </div>
        ))}
      </div>

      
    </div>
  )
}
