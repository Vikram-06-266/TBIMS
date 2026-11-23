import { ApiError } from './products-api.js'

const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || '').replace(/\/+$/, '')

async function request(path, options = {}) {
  const { token, ...fetchOptions } = options
  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...fetchOptions,
      headers: {
        Accept: 'application/json',
        ...(fetchOptions.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...fetchOptions.headers,
      },
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new ApiError(
      'Could not reach the TBIMS API backend. Ensure the backend server is running.',
      { code: 'NETWORK_ERROR' },
    )
  }

  let payload
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  const requestId = payload?.requestId || response.headers.get('X-Request-ID')
  if (!response.ok) {
    throw new ApiError(
      payload?.error?.message || payload?.error || `API request failed with status ${response.status}.`,
      {
        status: response.status,
        code: payload?.error?.code || payload?.code || 'HTTP_ERROR',
        requestId,
      },
    )
  }

  return { payload, requestId }
}

export async function getDatabaseHealth({ signal } = {}) {
  const { payload } = await request('/api/health/db', { signal })
  return payload
}

export async function getDashboardKpis({ token, signal } = {}) {
  const { payload } = await request('/api/inventory/kpis', { token, signal })
  return payload.kpis
}

export async function getStockLedger({ token, signal } = {}) {
  const { payload } = await request('/api/inventory/ledger', { token, signal })
  return payload.movements || []
}

export async function receiveStockApi(intakeData, { token } = {}) {
  const { payload } = await request('/api/inventory/receive', {
    method: 'POST',
    body: JSON.stringify(intakeData),
    token,
  })
  return payload.product
}

export async function getOrdersApi({ token, signal } = {}) {
  const { payload } = await request('/api/orders', { token, signal })
  return payload.orders || []
}

export async function createOrderApi(orderData, { token } = {}) {
  const { payload } = await request('/api/orders', {
    method: 'POST',
    body: JSON.stringify(orderData),
    token,
  })
  return payload.order
}

export async function confirmOrderApi(orderId, { token } = {}) {
  const { payload } = await request(`/api/orders/${orderId}/confirm`, {
    method: 'POST',
    token,
  })
  return payload.order
}

export async function cancelOrderApi(orderId, { token } = {}) {
  const { payload } = await request(`/api/orders/${orderId}/cancel`, {
    method: 'POST',
    token,
  })
  return payload.order
}

export async function processReturnApi(orderId, returnData, { token } = {}) {
  const { payload } = await request(`/api/orders/${orderId}/return`, {
    method: 'POST',
    body: JSON.stringify(returnData),
    token,
  })
  return payload.return
}

export async function getAuditLogsApi({ token, signal } = {}) {
  const { payload } = await request('/api/audit-logs', { token, signal })
  return payload.logs || []
}

export async function getCustomerProductsApi({ query, limit, offset } = {}, { token, signal } = {}) {
  const params = new URLSearchParams()
  if (query) params.set('query', query)
  if (limit) params.set('limit', limit)
  if (offset) params.set('offset', offset)
  const qs = params.toString() ? `?${params.toString()}` : ''
  const { payload } = await request(`/api/shop/products${qs}`, { token, signal })
  return payload.products || []
}

export async function customerCheckoutApi(checkoutData, { token } = {}) {
  const { payload } = await request('/api/shop/checkout', {
    method: 'POST',
    body: JSON.stringify(checkoutData),
    token,
  })
  return payload.order
}

export async function getCustomerOrdersApi({ token, signal } = {}) {
  const { payload } = await request('/api/shop/orders', { token, signal })
  return payload.orders || []
}

export async function cancelCustomerOrderApi(orderId, { token } = {}) {
  const { payload } = await request(`/api/shop/orders/${orderId}/cancel`, {
    method: 'POST',
    token,
  })
  return payload.order
}
