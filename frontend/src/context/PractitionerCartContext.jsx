import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.jsx'
import { getCartSummary } from '../api/client'

/** Session key — optional hint when opening “order for patient” from the directory. */
export const PRACTITIONER_PATIENT_USER_KEY = 'pp_selected_patient_user_id'

/** JSON `{ userId, name, email }` so add-to-cart can show the label before the roster loads. */
export const PRACTITIONER_PATIENT_HINT_KEY = 'pp_selected_patient_hint'

const defaultValue = {
  totalQty: 0,
  selfQty: 0,
  forPatientsQty: 0,
  summary: null,
  drawerOpen: false,
  refresh: () => {},
  openDrawer: () => {},
  closeDrawer: () => {},
  ready: true,
}

const PractitionerCartContext = createContext(defaultValue)

export function PractitionerCartProvider({ children }) {
  const { user } = useAuth()
  const location = useLocation()
  const [totalQty, setTotalQty] = useState(0)
  const [selfQty, setSelfQty] = useState(0)
  const [forPatientsQty, setForPatientsQty] = useState(0)
  const [summary, setSummary] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [ready, setReady] = useState(false)

  const refresh = useCallback(async () => {
    if (user?.role !== 'practitioner') {
      setReady(true)
      return
    }
    try {
      const data = await getCartSummary()
      setSummary(data)
      setTotalQty(Number(data?.aggregate?.totalItemQty) || 0)
      setSelfQty(Number(data?.aggregate?.selfQty) || 0)
      setForPatientsQty(Number(data?.aggregate?.forPatientsQty) || 0)
    } catch {
      setSummary(null)
      setTotalQty(0)
      setSelfQty(0)
      setForPatientsQty(0)
    } finally {
      setReady(true)
    }
  }, [user?.role])

  const openDrawer = useCallback(() => setDrawerOpen(true), [])
  const closeDrawer = useCallback(() => setDrawerOpen(false), [])

  useEffect(() => {
    if (user?.role !== 'practitioner') return
    setReady(false)
    refresh()
  }, [user?.role, refresh, location.pathname])

  useEffect(() => {
    const h = () => refresh()
    window.addEventListener('pp-cart-changed', h)
    return () => window.removeEventListener('pp-cart-changed', h)
  }, [refresh])

  const value = useMemo(
    () => ({
      totalQty,
      selfQty,
      forPatientsQty,
      summary,
      drawerOpen,
      setDrawerOpen,
      refresh,
      openDrawer,
      closeDrawer,
      ready,
    }),
    [totalQty, selfQty, forPatientsQty, summary, drawerOpen, refresh, openDrawer, closeDrawer, ready],
  )

  if (user?.role !== 'practitioner') {
    return <PractitionerCartContext.Provider value={defaultValue}>{children}</PractitionerCartContext.Provider>
  }
  return <PractitionerCartContext.Provider value={value}>{children}</PractitionerCartContext.Provider>
}

export function usePractitionerCart() {
  return useContext(PractitionerCartContext)
}

export function notifyPractitionerCartChanged() {
  window.dispatchEvent(new Event('pp-cart-changed'))
}
