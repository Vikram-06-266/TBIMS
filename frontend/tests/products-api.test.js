import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ApiError,
  getCurrentUser,
  getProducts,
  signIn,
  signOut,
} from '../src/services/products-api.js'

async function withMockFetch(handler, run) {
  const originalFetch = globalThis.fetch
  globalThis.fetch = handler
  try {
    await run()
  } finally {
    globalThis.fetch = originalFetch
  }
}

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'X-Request-ID': 'request-123' }),
    async json() {
      return payload
    },
  }
}

test('sign-in posts credentials and validates the returned session', async () => {
  await withMockFetch(async (url, options) => {
    assert.equal(url, '/api/auth/login')
    assert.equal(options.method, 'POST')
    assert.equal(options.headers['Content-Type'], 'application/json')
    assert.deepEqual(JSON.parse(options.body), {
      username: 'admin',
      password: 'passphrase',
    })
    return jsonResponse({
      ok: true,
      data: {
        token: 'signed-token',
        user: { username: 'admin', role: 'admin' },
      },
    })
  }, async () => {
    const session = await signIn({ username: 'admin', password: 'passphrase' })
    assert.deepEqual(session, {
      token: 'signed-token',
      user: { username: 'admin', role: 'admin' },
      requestId: 'request-123',
    })
  })
})

test('current-user lookup verifies the bearer session and role', async () => {
  await withMockFetch(async (url, options) => {
    assert.equal(url, '/api/auth/me')
    assert.equal(options.headers.Authorization, 'Bearer signed-token')
    return jsonResponse({
      ok: true,
      data: { user: { username: 'admin@example.test', role: 'admin' } },
    })
  }, async () => {
    const result = await getCurrentUser({ token: 'signed-token' })
    assert.deepEqual(result.user, {
      username: 'admin@example.test',
      role: 'admin',
    })
  })
})

test('current-user lookup rejects roles outside the backend contract', async () => {
  await withMockFetch(
    async () => jsonResponse({
      ok: true,
      data: { user: { username: 'admin', role: 'superuser' } },
    }),
    async () => {
      await assert.rejects(
        getCurrentUser({ token: 'signed-token' }),
        (error) => {
          assert.ok(error instanceof ApiError)
          assert.equal(error.code, 'INVALID_API_RESPONSE')
          return true
        },
      )
    },
  )
})

test('sign-out calls the authenticated server logout endpoint', async () => {
  await withMockFetch(async (url, options) => {
    assert.equal(url, '/api/auth/logout')
    assert.equal(options.method, 'POST')
    assert.equal(options.headers.Authorization, 'Bearer signed-token')
    return jsonResponse({ ok: true, data: { loggedOut: true } })
  }, async () => {
    await signOut({ token: 'signed-token' })
  })
})

test('accepts owner and customer roles returned by the authentication API', async () => {
  for (const [username, role] of [
    ['owner', 'owner'],
    ['customer', 'customer'],
  ]) {
    await withMockFetch(
      async () =>
        jsonResponse({
          ok: true,
          data: { token: 'signed-token', user: { username, role } },
        }),
      async () => {
        const session = await signIn({ username, password: 'passphrase' })
        assert.equal(session.user.role, role)
      },
    )
  }
})

test('product listing sends the bearer token and validated text filters', async () => {
  const products = [{ id: 1, sku: 'SKU-1' }]
  await withMockFetch(async (url, options) => {
    assert.equal(url, '/api/products?name=lamp&category=Lighting')
    assert.equal(options.headers.Authorization, 'Bearer signed-token')
    return jsonResponse({ ok: true, data: { products } })
  }, async () => {
    const result = await getProducts(
      { name: ' lamp ', category: 'Lighting' },
      { token: 'signed-token' },
    )
    assert.deepEqual(result.products, products)
  })
})

test('API failures preserve safe status and request ID details', async () => {
  await withMockFetch(
    async () => jsonResponse({
      ok: false,
      error: { code: 'UNAUTHENTICATED', message: 'Sign in required.' },
      requestId: 'request-401',
    }, 401),
    async () => {
      await assert.rejects(
        getProducts({}, { token: 'expired-token' }),
        (error) => {
          assert.ok(error instanceof ApiError)
          assert.equal(error.status, 401)
          assert.equal(error.code, 'UNAUTHENTICATED')
          assert.equal(error.requestId, 'request-401')
          return true
        },
      )
    },
  )
})
