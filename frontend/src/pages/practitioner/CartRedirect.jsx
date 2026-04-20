import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePractitionerCart } from '../../context/PractitionerCartContext.jsx'

/** Legacy /practitioner/cart URL: opens the cart drawer and returns to catalog. */
export default function PractitionerCartRedirect() {
  const navigate = useNavigate()
  const { openDrawer } = usePractitionerCart()

  useEffect(() => {
    openDrawer()
    navigate('/practitioner/catalog/lab-test', { replace: true })
  }, [navigate, openDrawer])

  return (
    <div className="p-6 text-sm text-muted-foreground">Opening cart…</div>
  )
}
