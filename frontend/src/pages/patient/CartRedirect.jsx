import { useLayoutEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { usePatientCart } from '../../context/PatientCartContext.jsx'

const FOCUS_SESSION_KEY = 'pp_cart_scroll_recommendations'

/**
 * Legacy /patient/cart URL: open the header cart drawer and go to the catalog.
 * ?focus=recommendations — scroll to practitioner suggestions in the drawer after open.
 */
export default function PatientCartRedirect() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { openDrawer } = usePatientCart()
  const focusRecommendations = searchParams.get('focus') === 'recommendations'

  useLayoutEffect(() => {
    if (focusRecommendations) {
      try {
        sessionStorage.setItem(FOCUS_SESSION_KEY, '1')
      } catch {
        /* ignore */
      }
    }
    openDrawer()
    navigate('/patient/catalog/lab-test', { replace: true })
  }, [openDrawer, navigate, focusRecommendations])

  return (
    <div className="flex min-h-[30vh] items-center justify-center">
      <p className="text-sm text-muted-foreground">Opening your cart…</p>
    </div>
  )
}
