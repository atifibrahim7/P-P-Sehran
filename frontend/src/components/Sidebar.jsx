import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  Truck,
  Users,
  ClipboardList,
  Coins,
  FlaskConical,
  Sparkles,
  ListOrdered,
  UserRound,
  Store,
} from 'lucide-react'
import { api, getCommissionsPage, getOrdersPage, getProductsPage, getUsersPage, getVendorsPage } from '../api/client'
import { useAuth } from '../auth/AuthProvider.jsx'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

export default function Sidebar({ onNavigate }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [counts, setCounts] = useState({})

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        if (!user) return
        const role = user.role
        if (role === 'admin') {
          const [psSupp, psLab, vs, us, os, cs] = await Promise.allSettled([
            getProductsPage({ type: 'supplement', page: 1, pageSize: 1 }),
            getProductsPage({ type: 'lab_test', page: 1, pageSize: 1 }),
            getVendorsPage({ page: 1, pageSize: 1 }),
            getUsersPage({ page: 1, pageSize: 1 }),
            getOrdersPage({ page: 1, pageSize: 1 }),
            api('/commissions'),
          ])
          if (!mounted) return
          const commRaw = cs.status === 'fulfilled' ? cs.value : null
          const commLen = Array.isArray(commRaw) ? commRaw.length : commRaw?.commissions?.length ?? 0
          setCounts({
            supplements: psSupp.status === 'fulfilled' ? psSupp.value.pagination.total : 0,
            labTests: psLab.status === 'fulfilled' ? psLab.value.pagination.total : 0,
            vendors: vs.status === 'fulfilled' ? vs.value.pagination.total : 0,
            users: us.status === 'fulfilled' ? us.value.pagination.total : 0,
            orders: os.status === 'fulfilled' ? os.value.pagination?.total ?? 0 : 0,
            commissions: commLen,
          })
        } else if (role === 'practitioner') {
          const [os, rs, commRes] = await Promise.allSettled([
            getOrdersPage({ page: 1, pageSize: 1 }),
            api('/lab/results'),
            getCommissionsPage({ page: 1, pageSize: 1 }),
          ])
          if (!mounted) return
          const commPending =
            commRes.status === 'fulfilled' && commRes.value?.summary?.pendingLineCount != null
              ? Number(commRes.value.summary.pendingLineCount)
              : 0
          setCounts({
            orders: os.status === 'fulfilled' ? os.value.pagination?.total ?? 0 : 0,
            results: rs.status === 'fulfilled' ? rs.value.length : 0,
            commissions: commPending,
          })
        } else if (role === 'patient') {
          const [os, rs] = await Promise.allSettled([
            getOrdersPage({ page: 1, pageSize: 1 }),
            api('/lab/results'),
          ])
          if (!mounted) return
          setCounts({
            orders: os.status === 'fulfilled' ? os.value.pagination?.total ?? 0 : 0,
            results: rs.status === 'fulfilled' ? rs.value.length : 0,
          })
        }
      } catch {
        // ignore counts errors
      }
    })()
    return () => {
      mounted = false
    }
  }, [user])

  const items = useMemo(() => {
    if (!user) return []
    const r = user.role
    if (r === 'admin') {
      return [
        { label: 'Dashboard', to: '/admin', icon: LayoutDashboard },
        { label: 'Lab Tests', to: '/admin/products/lab-test', icon: Package, count: counts.labTests },
        { label: 'Supplements', to: '/admin/products/supplement', icon: Package, count: counts.supplements },
        { label: 'Vendors', to: '/admin/vendors', icon: Truck, count: counts.vendors },
        { label: 'Users', to: '/admin/users', icon: Users, count: counts.users },
        { label: 'Orders', to: '/admin/orders', icon: ClipboardList, count: counts.orders },
        { label: 'Commissions', to: '/admin/commissions', icon: Coins, count: counts.commissions },
      ]
    }
    if (r === 'practitioner') {
      return [
        { label: 'Dashboard', to: '/practitioner', icon: LayoutDashboard },
        { label: 'Patients', to: '/practitioner/patients', icon: Users },
        { label: 'Catalog', to: '/practitioner/catalog', icon: Package, matchPrefix: '/practitioner/catalog' },
        {
          label: 'Orders',
          to: '/practitioner/orders',
          icon: ListOrdered,
          count: counts.orders,
          badgeCount: counts.commissions,
        },
        { label: 'Recommendations', to: '/practitioner/recommendations', icon: Sparkles },
        { label: 'Test Results', to: '/practitioner/test-results', icon: FlaskConical, count: counts.results },
      ]
    }
    return [
      { label: 'Dashboard', to: '/patient', icon: LayoutDashboard },
      {
        label: 'Catalog',
        to: '/patient/catalog/lab-test',
        icon: Store,
        matchPrefix: '/patient/catalog',
      },
      { label: 'Recommendations', to: '/patient/recommendations', icon: Sparkles },
      { label: 'Orders', to: '/patient/orders', icon: ListOrdered, count: counts.orders },
      { label: 'Test Results', to: '/patient/test-results', icon: FlaskConical, count: counts.results },
      { label: 'Profile', to: '/patient/profile', icon: UserRound },
    ]
  }, [user, counts])

  const handleNav = (to) => {
    if (location.pathname !== to) {
      navigate(to)
    }
    onNavigate?.()
  }

  return (
    <div className="flex flex-col gap-1 p-3">
      <p className="px-2 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Menu</p>
      <Separator className="mb-1 bg-sidebar-border" />
      <nav className="flex flex-col gap-0.5">
        {items.map((item) => {
          const active =
            item.matchPrefix != null ? location.pathname.startsWith(item.matchPrefix) : location.pathname === item.to
          const Icon = item.icon
          return (
            <Button
              key={item.to}
              type="button"
              variant={active ? 'secondary' : 'ghost'}
              className={cn(
                'h-auto min-h-9 w-full justify-start gap-2 px-2 py-1.5 font-normal',
                active && 'bg-sidebar-accent text-sidebar-accent-foreground',
              )}
              onClick={() => handleNav(item.to)}
            >
              <Icon className="size-4 shrink-0 opacity-90" />
              <span className="flex-1 truncate text-left">{item.label}</span>
              {item.count != null || (item.badgeCount != null && item.badgeCount > 0) ? (
                <span className="ml-auto flex shrink-0 gap-1">
                  {item.count != null ? (
                    <Badge variant="outline" className="text-[10px] tabular-nums">
                      {item.count}
                    </Badge>
                  ) : null}
                  {item.badgeCount != null && item.badgeCount > 0 ? (
                    <Badge variant="secondary" className="text-[10px] tabular-nums" title="Pending commission payouts">
                      {item.badgeCount}
                    </Badge>
                  ) : null}
                </span>
              ) : null}
            </Button>
          )
        })}
      </nav>
    </div>
  )
}
