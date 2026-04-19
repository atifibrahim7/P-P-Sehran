import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Package,
  FlaskConical,
  Truck,
  Users,
  ClipboardList,
  Coins,
  Banknote,
} from 'lucide-react'
import { api, getOrders, getProductsPage, getUsersPage, getVendorsPage } from '../../api/client'
import KpiCard from '../../components/KpiCard.jsx'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

function formatMoney(n) {
  if (n == null || Number.isNaN(n)) return '—'
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(n)
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        const [psSupp, psLab, vs, us, orders, commRaw] = await Promise.all([
          getProductsPage({ type: 'supplement', page: 1, pageSize: 1 }),
          getProductsPage({ type: 'lab_test', page: 1, pageSize: 1 }),
          getVendorsPage({ page: 1, pageSize: 1 }),
          getUsersPage({ page: 1, pageSize: 1 }),
          getOrders(),
          api('/commissions'),
        ])
        if (!mounted) return
        const orderList = Array.isArray(orders) ? orders : []
        const commList = Array.isArray(commRaw) ? commRaw : commRaw?.commissions || []
        const patientTotal = orderList.reduce((s, o) => s + Number(o.total_patient || 0), 0)
        const practitionerTotal = orderList.reduce((s, o) => s + Number(o.total_practitioner || 0), 0)
        const commissionSum =
          commRaw?.summary?.pendingPayoutTotal ??
          commList.filter((c) => c.payoutStatus !== 'PAID').reduce((s, c) => s + Number(c.amount || 0), 0)
        const paidOrders = orderList.filter((o) => String(o.state).toLowerCase() === 'paid').length
        setData({
          supplements: psSupp.pagination?.total ?? 0,
          labTests: psLab.pagination?.total ?? 0,
          vendors: vs.pagination?.total ?? 0,
          users: us.pagination?.total ?? 0,
          orders: orderList.length,
          paidOrders,
          patientTotal,
          practitionerTotal,
          commissionCount: commList.length,
          commissionSum,
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
      { title: 'Lab tests (SKU)', value: loading ? '—' : data.labTests, subtitle: 'Active catalog items', icon: FlaskConical, colorKey: 'primary' },
      { title: 'Supplements (SKU)', value: loading ? '—' : data.supplements, subtitle: 'Active catalog items', icon: Package, colorKey: 'primary' },
      { title: 'Vendors', value: loading ? '—' : data.vendors, subtitle: 'Lab & supplement partners', icon: Truck, colorKey: 'primary' },
      { title: 'Users', value: loading ? '—' : data.users, subtitle: 'Accounts on the platform', icon: Users, colorKey: 'primary' },
      { title: 'Orders', value: loading ? '—' : data.orders, subtitle: `${data.paidOrders} paid`, icon: ClipboardList, colorKey: 'primary' },
      { title: 'Patient revenue', value: loading ? '—' : formatMoney(data.patientTotal), subtitle: 'Sum of order totals (patient)', icon: Banknote, colorKey: 'primary' },
      { title: 'Practitioner revenue', value: loading ? '—' : formatMoney(data.practitionerTotal), subtitle: 'Sum of order totals (practitioner)', icon: Banknote, colorKey: 'primary' },
      {
        title: 'Commissions (pending payout)',
        value: loading ? '—' : formatMoney(data.commissionSum),
        subtitle: `${data.commissionCount} commission lines`,
        icon: Coins,
        colorKey: 'primary',
      },
    ]
  }, [data, loading])

  return (
    <div className="space-y-8 ">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Overview of catalog, users, orders, and revenue for your healthcare commerce platform.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.title} className="bg-white rounded-lg shadow-lg">
            {loading && !data ? <Skeleton className="h-[132px] rounded-xl" /> : <KpiCard {...k} />}
          </div>
        ))}
      </div>

     
    </div>
  )
}
