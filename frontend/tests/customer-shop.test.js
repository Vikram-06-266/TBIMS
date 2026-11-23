import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getCustomerProductsApi,
  customerCheckoutApi,
  getCustomerOrdersApi,
  cancelCustomerOrderApi,
} from '../src/services/inventory-api.js'

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
    headers: new Headers({ 'X-Request-ID': 'req-test-123' }),
    async json() {
      return payload
    },
  }
}

test('getCustomerProductsApi sends query params and returns catalogue', async () => {
  await withMockFetch(
    async (url, options) => {
      assert.equal(url, '/api/shop/products?query=laptop&limit=10')
      assert.equal(options.headers['Authorization'], 'Bearer customer-token')
      return jsonResponse({
        ok: true,
        products: [
          { id: 1, sku: 'LAP-001', name: 'Gaming Laptop', unit_price: '75000', available: 5, in_stock: true },
        ],
      })
    },
    async () => {
      const products = await getCustomerProductsApi(
        { query: 'laptop', limit: 10 },
        { token: 'customer-token' },
      )
      assert.equal(products.length, 1)
      assert.equal(products[0].sku, 'LAP-001')
      assert.equal(products[0].available, 5)
    },
  )
})

test('customerCheckoutApi submits items and receives placed order', async () => {
  await withMockFetch(
    async (url, options) => {
      assert.equal(url, '/api/shop/checkout')
      assert.equal(options.method, 'POST')
      assert.equal(options.headers['Authorization'], 'Bearer customer-token')
      const body = JSON.parse(options.body)
      assert.deepEqual(body, {
        items: [{ productId: 1, sku: 'LAP-001', quantity: 2 }],
      })
      return jsonResponse({
        ok: true,
        order: {
          id: '101',
          orderNumber: 'ORD-2026-101',
          status: 'PENDING',
          customerName: 'customer',
          totalAmount: '150000.00',
        },
      }, 201)
    },
    async () => {
      const order = await customerCheckoutApi(
        { items: [{ productId: 1, sku: 'LAP-001', quantity: 2 }] },
        { token: 'customer-token' },
      )
      assert.equal(order.id, '101')
      assert.equal(order.status, 'PENDING')
      assert.equal(order.customerName, 'customer')
    },
  )
})

test('getCustomerOrdersApi retrieves customer-owned orders', async () => {
  await withMockFetch(
    async (url, options) => {
      assert.equal(url, '/api/shop/orders')
      assert.equal(options.headers['Authorization'], 'Bearer customer-token')
      return jsonResponse({
        ok: true,
        orders: [
          { id: '101', orderNumber: 'ORD-2026-101', status: 'PENDING', totalAmount: '150000.00' },
        ],
      })
    },
    async () => {
      const orders = await getCustomerOrdersApi({ token: 'customer-token' })
      assert.equal(orders.length, 1)
      assert.equal(orders[0].id, '101')
    },
  )
})

test('cancelCustomerOrderApi posts cancellation request for order', async () => {
  await withMockFetch(
    async (url, options) => {
      assert.equal(url, '/api/shop/orders/101/cancel')
      assert.equal(options.method, 'POST')
      assert.equal(options.headers['Authorization'], 'Bearer customer-token')
      return jsonResponse({
        ok: true,
        order: { id: '101', status: 'CANCELLED' },
      })
    },
    async () => {
      const order = await cancelCustomerOrderApi('101', { token: 'customer-token' })
      assert.equal(order.status, 'CANCELLED')
    },
  )
})

test('cart calculations correctly compute line totals and order totals', () => {
  const cart = [
    { product: { id: 1, unit_price: '500.00' }, quantity: 3 },
    { product: { id: 2, unit_price: '120.50' }, quantity: 2 },
  ]

  const lineTotals = cart.map((item) => Number(item.product.unit_price) * item.quantity)
  assert.equal(lineTotals[0], 1500.00)
  assert.equal(lineTotals[1], 241.00)

  const orderTotal = cart.reduce((sum, item) => sum + Number(item.product.unit_price) * item.quantity, 0)
  assert.equal(orderTotal, 1741.00)
})
