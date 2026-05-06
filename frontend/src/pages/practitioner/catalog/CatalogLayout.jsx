import { NavLink, Outlet, Navigate } from 'react-router-dom'
import { FlaskConical, Pill } from 'lucide-react'
import { cn } from '@/lib/utils'

const tabs = [
  { to: '/practitioner/catalog/lab-test', label: 'Lab tests', icon: FlaskConical },
  { to: '/practitioner/catalog/supplement', label: 'Supplements', icon: Pill },
]

export default function PractitionerCatalogLayout() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Catalog</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Add products from each tab. Every add opens a dialog for quantity and recipient. The header cart holds
          everything until you place orders (one checkout per you and per patient).
        </p>
      </div>

      
      <div className="flex flex-wrap gap-2 rounded-xl border border-border/80 bg-muted/30 p-1.5">
        {tabs.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors sm:flex-none sm:justify-start',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
              )
            }
          >
            <Icon className="size-4 shrink-0 opacity-80" />
            {label}
          </NavLink>
        ))}
      </div>
      

      <Outlet />
    </div>
  )
}

export function PractitionerCatalogIndexRedirect() {
  return <Navigate to="/practitioner/catalog/lab-test" replace />
}
