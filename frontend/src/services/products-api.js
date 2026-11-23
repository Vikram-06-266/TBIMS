let rawBase = (import.meta.env?.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '')
if (rawBase && !rawBase.includes('.') && !rawBase.startsWith('localhost')) {
  rawBase = `${rawBase}.onrender.com`
}
const API_BASE_URL = rawBase && !rawBase.startsWith('http://') && !rawBase.startsWith('https://')
  ? `https://${rawBase}`
  : rawBase
const supportedRoles = new Set([
  'owner',
  'admin',
  'inventoryManager',
  'staff',
  'customer',
])

export class ApiError extends Error {
  constructor(message, { status = null, code = 'API_ERROR', requestId = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.requestId = requestId
  }
}

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
      'Could not reach the inventory API. Start the backend and try again.',
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
      payload?.error?.message || `The API request failed with status ${response.status}.`,
      {
        status: response.status,
        code: payload?.error?.code || 'HTTP_ERROR',
        requestId,
      },
    )
  }

  return { payload, requestId }
}

export async function signIn(credentials) {
  const { payload, requestId } = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  })
  const user = payload?.data?.user
  const token = payload?.data?.token
  if (
    typeof token !== 'string' ||
    !user ||
    typeof user.username !== 'string' ||
    !supportedRoles.has(user.role)
  ) {
    throw new ApiError('The API returned an invalid sign-in response.', {
      code: 'INVALID_API_RESPONSE',
      requestId,
    })
  }

  return { token, user, requestId }
}

export async function getCurrentUser({ token, signal } = {}) {
  const { payload, requestId } = await request('/api/auth/me', {
    signal,
    token,
  })
  const user = payload?.data?.user
  if (
    !user ||
    typeof user.username !== 'string' ||
    !supportedRoles.has(user.role)
  ) {
    throw new ApiError('The API returned an invalid user session.', {
      code: 'INVALID_API_RESPONSE',
      requestId,
    })
  }

  return { user, requestId }
}

export async function signOut({ token } = {}) {
  await request('/api/auth/logout', {
    method: 'POST',
    token,
  })
}

export async function getProducts(filters = {}, { signal, token } = {}) {
  const query = new URLSearchParams()
  for (const key of ['sku', 'name', 'category']) {
    if (filters[key]?.trim()) query.set(key, filters[key].trim())
  }
  const suffix = query.size ? `?${query.toString()}` : ''
  const { payload, requestId } = await request(`/api/products${suffix}`, {
    signal,
    token,
  })
  if (!Array.isArray(payload?.data?.products)) {
    throw new ApiError('The API returned an invalid product list.', {
      code: 'INVALID_API_RESPONSE',
      requestId,
    })
  }

  return { products: payload.data.products, requestId }
}

export async function createProduct(product, { token } = {}) {
  const { payload, requestId } = await request('/api/products', {
    method: 'POST',
    body: JSON.stringify(product),
    token,
  })
  if (!payload?.data?.product || typeof payload.data.product !== 'object') {
    throw new ApiError('The API returned an invalid product response.', {
      code: 'INVALID_API_RESPONSE',
      requestId,
    })
  }

  return { product: payload.data.product, requestId }
}

export async function updateProduct(id, product, { token } = {}) {
  const { payload, requestId } = await request(`/api/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(product),
    token,
  })
  if (!payload?.data?.product || typeof payload.data.product !== 'object') {
    throw new ApiError('The API returned an invalid product update response.', {
      code: 'INVALID_API_RESPONSE',
      requestId,
    })
  }

  return { product: payload.data.product, requestId }
}
