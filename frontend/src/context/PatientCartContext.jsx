import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.jsx'
import { getCart } from '../api/client'

const defaultValue = {
  totalQty: 0,
  cart: null,
  cartMessage: null,
  drawerOpen: false,
  refresh: () => {},
  openDrawer: () => {},
  closeDrawer: () => {},
  ready: true,
}

const PatientCartContext = createContext(defaultValue)

function sumItemQty(items) {
  if (!Array.isArray(items)) return 0
  return items.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0)
}

export function PatientCartProvider({ children }) {
  const { user } = useAuth()
  const location = useLocation()
  const [totalQty, setTotalQty] = useState(0)
  const [cart, setCart] = useState(null)
  const [cartMessage, setCartMessage] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [ready, setReady] = useState(false)

  const refresh = useCallback(async () => {
    if (user?.role !== 'patient') {
      setReady(true)
      return
    }
    try {
      const data = await getCart()
      if (data?.cart === null && data?.message) {
        setCart(null)
        setCartMessage(data.message)
        setTotalQty(0)
      } else {
        setCart(data?.cart ?? null)
        setCartMessage(null)
        setTotalQty(sumItemQty(data?.cart?.items))
      }
    } catch {
      setCart(null)
      setCartMessage(null)
      setTotalQty(0)
    } finally {
      setReady(true)
    }
  }, [user?.role])

  const openDrawer = useCallback(() => setDrawerOpen(true), [])
  const closeDrawer = useCallback(() => setDrawerOpen(false), [])

  useEffect(() => {
    if (user?.role !== 'patient') return
    setReady(false)
    refresh()
  }, [user?.role, refresh, location.pathname])

  useEffect(() => {
    const h = () => refresh()
    window.addEventListener('pp-patient-cart-changed', h)
    return () => window.removeEventListener('pp-patient-cart-changed', h)
  }, [refresh])

  const value = useMemo(
    () => ({
      totalQty,
      cart,
      cartMessage,
      drawerOpen,
      setDrawerOpen,
      refresh,
      openDrawer,
      closeDrawer,
      ready,
    }),
    [totalQty, cart, cartMessage, drawerOpen, refresh, openDrawer, closeDrawer, ready],
  )

  if (user?.role !== 'patient') {
    return <PatientCartContext.Provider value={defaultValue}>{children}</PatientCartContext.Provider>
  }
  return <PatientCartContext.Provider value={value}>{children}</PatientCartContext.Provider>
}

export function usePatientCart() {
  return useContext(PatientCartContext)
}

export function notifyPatientCartChanged() {
  window.dispatchEvent(new Event('pp-patient-cart-changed'))
}
