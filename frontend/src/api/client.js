const BASE_URL = 'http://localhost:3001/api'

let token = null

export function setToken(nextToken) {
  token = nextToken
}

export function getToken() {
  return token
}

async function parseJson(res) {
  try {
    return await res.json()
  } catch {
    return null
  }
}

export async function api(path, init = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
    credentials: 'omit',
  })

  const body = await parseJson(res)
  if (!body) {
    throw Object.assign(new Error(`Unexpected response (${res.status})`), { status: res.status })
  }

  if (body.success) {
    return body.data
  }

  const message = body?.error?.message ?? 'Unknown error'
  const code = body?.error?.code
  const details = body?.error?.details
  if (res.status === 401) {
    setToken(null)
    throw Object.assign(new Error(message), { status: 401, code, details })
  }
  if (res.status === 403) {
    throw Object.assign(new Error(message), { status: 403, code, details })
  }
  throw Object.assign(new Error(message), { status: res.status, code, details })
}

// Auth
export async function login(email, password) {
  const data = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  setToken(data.token)
  return data
}

export const getMe = () => api('/users/me')

function asPaginated(result) {
  if (Array.isArray(result)) {
    return {
      items: result,
      pagination: { page: 1, pageSize: result.length || 10, total: result.length, totalPages: 1 },
    }
  }
  return result
}

// Common resources
export const getProducts = (params = {}) => {
  const search = new URLSearchParams()
  const merged = { page: 1, pageSize: 1000, ...params }
  Object.entries(merged).forEach(([key, value]) => {
    if (value != null && value !== '') search.set(key, String(value))
  })
  const suffix = search.toString() ? `?${search.toString()}` : ''
  return api(`/products${suffix}`).then((result) => asPaginated(result).items)
}
export const getProductsPage = (params = {}) => {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== '') search.set(key, String(value))
  })
  const suffix = search.toString() ? `?${search.toString()}` : ''
  return api(`/products${suffix}`).then(asPaginated)
}
export const getVendors = (params = {}) => {
  const search = new URLSearchParams()
  const merged = { page: 1, pageSize: 1000, ...params }
  Object.entries(merged).forEach(([key, value]) => {
    if (value != null && value !== '') search.set(key, String(value))
  })
  const suffix = search.toString() ? `?${search.toString()}` : ''
  return api(`/vendors${suffix}`).then((result) => asPaginated(result).items)
}
export const getVendorsPage = (params = {}) => {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== '') search.set(key, String(value))
  })
  const suffix = search.toString() ? `?${search.toString()}` : ''
  return api(`/vendors${suffix}`).then(asPaginated)
}
export const getUsersPage = (params = {}) => {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== '') search.set(key, String(value))
  })
  const suffix = search.toString() ? `?${search.toString()}` : ''
  return api(`/users${suffix}`).then(asPaginated)
}
export const createProduct = (payload) => api('/products', { method: 'POST', body: JSON.stringify(payload) })
export const updateProduct = (id, payload) => api(`/products/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
export const deleteProduct = (id) => api(`/products/${id}`, { method: 'DELETE' })

export const patchCommissionPayout = (id, payoutStatus) =>
  api(`/commissions/${id}`, { method: 'PATCH', body: JSON.stringify({ payoutStatus }) })

/** Practitioner: paginated list + global summary. Admin: use api('/commissions') for full payload. */
export const getCommissionsPage = (params = {}) => {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== '') search.set(key, String(value))
  })
  const suffix = search.toString() ? `?${search.toString()}` : ''
  return api(`/commissions${suffix}`)
}

/**
 * Upload a product image (admin). Sends multipart field "file".
 * @returns {Promise<string>} secure Cloudinary URL
 */
export async function uploadProductImage(file) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${BASE_URL}/uploads/image`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  })
  const body = await parseJson(res)
  if (!body) {
    throw Object.assign(new Error(`Unexpected response (${res.status})`), { status: res.status })
  }
  if (body.success && body.data?.url) {
    return body.data.url
  }
  const message = body?.error?.message ?? 'Upload failed'
  if (res.status === 401) {
    setToken(null)
    throw Object.assign(new Error(message), { status: 401 })
  }
  throw Object.assign(new Error(message), { status: res.status })
}
export const createVendor = (payload) => api('/vendors', { method: 'POST', body: JSON.stringify(payload) })
export const updateVendor = (id, payload) => api(`/vendors/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
export const createUser = (payload) => api('/users', { method: 'POST', body: JSON.stringify(payload) })
export const getUser = (id) => api(`/users/${id}`)
export const updateUser = (id, payload) => api(`/users/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
export const retryOrderInuviSync = (id) => api(`/orders/${id}/inuvi-sync`, { method: 'POST' })
export const getPractitionerPatients = (params = {}) => {
  const search = new URLSearchParams()
  if (params.q != null && params.q !== '') search.set('q', String(params.q))
  if (params.page != null && params.page !== '') search.set('page', String(params.page))
  if (params.limit != null && params.limit !== '') search.set('limit', String(params.limit))
  const q = search.toString()
  return api(`/patients${q ? `?${q}` : ''}`)
}

export const getPractitionerPatient = (userId) => api(`/patients/${userId}`)

export const createPractitionerPatient = (body) =>
  api('/patients', { method: 'POST', body: JSON.stringify(body) })
export const updatePractitionerPatient = (userId, body) =>
  api(`/patients/${userId}`, { method: 'PUT', body: JSON.stringify(body) })
export const deletePatientByUserId = (userId) => api(`/patients/${userId}`, { method: 'DELETE' })

// Carts (server-side; practitioner + patient)
export const getCart = (params = {}) => {
  const search = new URLSearchParams()
  if (params.forPatientUserId != null && params.forPatientUserId !== '') {
    search.set('forPatientUserId', String(params.forPatientUserId))
  }
  const q = search.toString()
  return api(`/carts${q ? `?${q}` : ''}`)
}
export const getCartSummary = () => api('/carts/summary')
export const addCartItem = (payload) =>
  api('/carts/items', { method: 'POST', body: JSON.stringify(payload) })
export const updateCartItem = (itemId, quantity) =>
  api(`/carts/items/${itemId}`, { method: 'PATCH', body: JSON.stringify({ quantity }) })
export const removeCartItem = (itemId) => api(`/carts/items/${itemId}`, { method: 'DELETE' })
export const checkoutCart = (payload) =>
  api('/carts/checkout', { method: 'POST', body: JSON.stringify(payload) })
export const clearCart = (payload = {}) =>
  api('/carts/clear', { method: 'POST', body: JSON.stringify(payload) })

// Orders
export const getOrdersPage = (params = {}) => {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== '') search.set(key, String(value))
  })
  const suffix = search.toString() ? `?${search.toString()}` : ''
  return api(`/orders${suffix}`).then(asPaginated)
}
export const getOrders = (params = {}) => {
  const merged = { page: 1, pageSize: 1000, ...params }
  return getOrdersPage(merged).then((r) => r.items)
}
export const getOrder = (id) => api(`/orders/${id}`)
export const createPractitionerSelfOrder = (items) =>
  api('/orders', { method: 'POST', body: JSON.stringify({ type: 'practitioner_self', items }) })
export const createPatientOrder = (patientId, items) =>
  api('/orders', { method: 'POST', body: JSON.stringify({ type: 'patient', patientId, items }) })

// Payments
export async function startCheckout(orderId, successUrl, cancelUrl) {
  const data = await api('/payments/checkout', {
    method: 'POST',
    body: JSON.stringify({ orderId, successUrl, cancelUrl }),
  })
  if (data?.url) {
    window.location.href = data.url
    return
  }
  if (data?.mode === 'mock' && data?.checkoutUrl) {
    window.location.href = data.checkoutUrl
    return
  }
  throw new Error('Invalid checkout response')
}

/** Patient: pay multiple pending PATIENT orders in one Stripe session (e.g. new cart order + practitioner suggestions). */
export async function startCheckoutOrders(orderIds, successUrl, cancelUrl) {
  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    throw new Error('orderIds required')
  }
  const data = await api('/payments/checkout', {
    method: 'POST',
    body: JSON.stringify({ orderIds, successUrl, cancelUrl }),
  })
  if (data?.url) {
    window.location.href = data.url
    return
  }
  if (data?.mode === 'mock' && data?.checkoutUrl) {
    window.location.href = data.checkoutUrl
    return
  }
  throw new Error('Invalid checkout response')
}

export async function mockMarkPaid(orderIdOrIds) {
  const requestBody =
    Array.isArray(orderIdOrIds) && orderIdOrIds.length
      ? { orderIds: orderIdOrIds }
      : { orderId: orderIdOrIds }
  const res = await fetch(`${BASE_URL}/payments/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  })
  const raw = await res.text()
  let parsed = null
  if (raw) {
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = null
    }
  }
  if (!res.ok) {
    const msg =
      (parsed && typeof parsed === 'object' && parsed.error?.message) ||
      (typeof parsed === 'string' ? parsed : null) ||
      raw ||
      `Payment failed (${res.status})`
    throw Object.assign(new Error(String(msg)), { status: res.status })
  }
  if (!parsed?.success || !parsed?.data) {
    throw new Error('Invalid mock payment response')
  }
  const data = parsed.data
  if (data.orders && Array.isArray(data.orders)) {
    if (!data.confirmed || !data.orders.length) throw new Error('Payment not confirmed')
    return data
  }
  if (!data.confirmed || data.order?.paymentStatus !== 'PAID') {
    throw new Error('Payment not confirmed')
  }
  return data
}

