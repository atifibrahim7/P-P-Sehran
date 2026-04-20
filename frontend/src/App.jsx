import { useState } from 'react'
import { Routes, Route, Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Menu, ShoppingCart } from 'lucide-react'
import { useAuth } from './auth/AuthProvider.jsx'
import { PractitionerCartProvider, usePractitionerCart } from './context/PractitionerCartContext.jsx'
import { PatientCartProvider, usePatientCart } from './context/PatientCartContext.jsx'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import LoginPage from './pages/Login.jsx'
import AdminProducts from './pages/admin/Products.jsx'
import AdminSupplements from './pages/admin/Supplements.jsx'
import AdminVendors from './pages/admin/Vendors.jsx'
import AdminUsers from './pages/admin/Users.jsx'
import AdminOrders from './pages/admin/Orders.jsx'
import AdminCommissions from './pages/admin/Commissions.jsx'
import PractitionerCatalogLayout, {
  PractitionerCatalogIndexRedirect,
} from './pages/practitioner/catalog/CatalogLayout.jsx'
import PractitionerCatalogBrowse from './pages/practitioner/catalog/CatalogBrowse.jsx'
import PractitionerCartDrawer from './components/practitioner/PractitionerCartDrawer.jsx'
import PractitionerCartRedirect from './pages/practitioner/CartRedirect.jsx'
import PractitionerOrders from './pages/practitioner/Orders.jsx'
import PractitionerRecommendations from './pages/practitioner/Recommendations.jsx'
import PractitionerTestResults from './pages/practitioner/TestResults.jsx'
import PractitionerPatients from './pages/practitioner/Patients.jsx'
import PatientRecommendations from './pages/patient/Recommendations.jsx'
import PatientCartRedirect from './pages/patient/CartRedirect.jsx'
import PatientCatalogLayout, { PatientCatalogIndexRedirect } from './pages/patient/catalog/PatientCatalogLayout.jsx'
import PatientCatalogBrowse from './pages/patient/catalog/PatientCatalogBrowse.jsx'
import PatientCartDrawer from './components/patient/PatientCartDrawer.jsx'
import PatientOrders from './pages/patient/Orders.jsx'
import PatientTestResults from './pages/patient/TestResults.jsx'
import PatientProfile from './pages/patient/Profile.jsx'
import OrderDetail from './pages/shared/OrderDetail.jsx'
import MockCheckout from './pages/shared/MockCheckout.jsx'
import AdminDashboard from './pages/dashboard/AdminDashboard.jsx'
import PractitionerDashboard from './pages/dashboard/PractitionerDashboard.jsx'
import PatientDashboard from './pages/dashboard/PatientDashboard.jsx'
import Sidebar from './components/Sidebar.jsx'

function Protected({ roles }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="p-6 text-muted-foreground">Loading...</div>
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/forbidden" replace />
  return <Outlet />
}

function PractitionerHeaderCart() {
  const { totalQty, openDrawer } = usePractitionerCart()
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="relative text-muted-foreground hover:text-foreground"
      onClick={() => openDrawer()}
      aria-label={`Cart${totalQty ? `, ${totalQty} items` : ''}`}
    >
      <ShoppingCart className="size-5" />
      {totalQty > 0 ? (
        <Badge
          className="pointer-events-none absolute -right-1 -top-1 min-w-[1.125rem] justify-center px-1 text-[10px] tabular-nums"
          variant="default"
        >
          {totalQty > 99 ? '99+' : totalQty}
        </Badge>
      ) : null}
    </Button>
  )
}

function PatientHeaderCart() {
  const { totalQty, openDrawer } = usePatientCart()
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="relative text-muted-foreground hover:text-foreground"
      onClick={() => openDrawer()}
      aria-label={`Cart${totalQty ? `, ${totalQty} items` : ''}`}
    >
      <ShoppingCart className="size-5" />
      {totalQty > 0 ? (
        <Badge
          className="pointer-events-none absolute -right-1 -top-1 min-w-[1.125rem] justify-center px-1 text-[10px] tabular-nums"
          variant="default"
        >
          {totalQty > 99 ? '99+' : totalQty}
        </Badge>
      ) : null}
    </Button>
  )
}

function Shell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const showSidebar = Boolean(user) && location.pathname !== '/login'

  return (
    <div className="flex min-h-svh flex-col">
      {user ? (
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {showSidebar ? (
              <Button type="button" variant="ghost" size="icon" className="md:hidden shrink-0" onClick={() => setMobileOpen(true)} aria-label="Open menu">
                <Menu className="size-5" />
              </Button>
            ) : null}
            <span className="min-w-0">
          <img src="../../../src/assets/MainLogo.png" alt="Logo" className="h-10 w-[150px]" />
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {user.role === 'practitioner' ? <PractitionerHeaderCart /> : null}
          {user.role === 'patient' ? <PatientHeaderCart /> : null}
          <span className="hidden max-w-[160px] truncate text-sm text-muted-foreground sm:inline">
            {user.name} ({user.role})
          </span>
          <Button type="button" variant="outline" size="sm" onClick={() => { logout(); navigate('/login') }}>
            Logout
          </Button>
          </div>
        </header>
      ) : null}

      <div className="flex min-h-0 flex-1">
        {showSidebar ? (
          <>
            <aside className="hidden w-[260px] shrink-0 overflow-y-auto border-r border-border bg-sidebar md:block">
              <Sidebar />
            </aside>
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetContent side="left" className="w-[260px] gap-0 overflow-y-auto p-0 sm:max-w-[260px]">
                <Sidebar onNavigate={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>
          </>
        ) : null}

        <main
          className={cn(
            'flex min-w-0 flex-1 flex-col bg-background',
            showSidebar && 'px-4 py-6 sm:px-6',
          )}
        >
          <div className={cn('mx-auto w-full flex-1', showSidebar && 'max-w-7xl')}>
            <Outlet />
          </div>
        </main>
      </div>
      {user?.role === 'practitioner' ? <PractitionerCartDrawer /> : null}
      {user?.role === 'patient' ? <PatientCartDrawer /> : null}
    </div>
  )
}

function Forbidden() {
  return <div className="p-6 text-muted-foreground">Forbidden</div>
}
function NotFound() {
  return <div className="p-6 text-muted-foreground">Not found</div>
}

export default function App() {
  return (
    <Routes>
      <Route
        element={
          <PractitionerCartProvider>
            <PatientCartProvider>
              <Shell />
            </PatientCartProvider>
          </PractitionerCartProvider>
        }
      >
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />

        <Route element={<Protected roles={['admin']} />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/products/lab-test" element={<AdminProducts />} />
          <Route path="/admin/products/supplement" element={<AdminSupplements />} />
          <Route path="/admin/products" element={<Navigate to="/admin/products/lab-test" replace />} />
          <Route path="/admin/vendors" element={<AdminVendors />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/orders" element={<AdminOrders />} />
          <Route path="/admin/commissions" element={<AdminCommissions />} />
        </Route>
        <Route element={<Protected roles={['practitioner']} />}>
          <Route path="/practitioner" element={<PractitionerDashboard />} />
          <Route path="/practitioner/patients" element={<PractitionerPatients />} />
          <Route path="/practitioner/catalog" element={<PractitionerCatalogLayout />}>
            <Route index element={<PractitionerCatalogIndexRedirect />} />
            <Route path="lab-test" element={<PractitionerCatalogBrowse category="lab_test" />} />
            <Route path="supplement" element={<PractitionerCatalogBrowse category="supplement" />} />
          </Route>
          <Route path="/practitioner/cart" element={<PractitionerCartRedirect />} />
          <Route path="/practitioner/orders" element={<PractitionerOrders />} />
          <Route path="/practitioner/recommendations" element={<PractitionerRecommendations />} />
          <Route path="/practitioner/test-results" element={<PractitionerTestResults />} />
          <Route
            path="/practitioner/commissions"
            element={<Navigate to="/practitioner/orders#practitioner-commissions" replace />}
          />
        </Route>
        <Route element={<Protected roles={['patient']} />}>
          <Route path="/patient" element={<PatientDashboard />} />
          <Route path="/patient/cart" element={<PatientCartRedirect />} />
          <Route path="/patient/catalog" element={<PatientCatalogLayout />}>
            <Route index element={<PatientCatalogIndexRedirect />} />
            <Route path="lab-test" element={<PatientCatalogBrowse category="lab_test" />} />
            <Route path="supplement" element={<PatientCatalogBrowse category="supplement" />} />
          </Route>
          <Route path="/patient/recommendations" element={<PatientRecommendations />} />
          <Route path="/patient/orders" element={<PatientOrders />} />
          <Route path="/patient/test-results" element={<PatientTestResults />} />
          <Route path="/patient/profile" element={<PatientProfile />} />
        </Route>

        <Route element={<Protected roles={['admin', 'practitioner', 'patient']} />}>
          <Route path="/mock-checkout" element={<MockCheckout />} />
          <Route path="/orders/:id" element={<OrderDetail />} />
        </Route>

        <Route path="/forbidden" element={<Forbidden />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
