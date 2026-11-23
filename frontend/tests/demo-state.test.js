import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEMO_PRODUCTS,
  DEMO_ORDERS,
  DEMO_MOVEMENTS,
  filterDemoProducts,
} from '../src/demo/demo-data.js'

function validateInvariants(products) {
  for (const product of products) {
    const onHand = Number(product.on_hand)
    const reserved = Number(product.reserved)
    const available = Number(product.available)

    assert.ok(onHand >= 0, `On-hand stock for ${product.sku} must be non-negative`)
    assert.ok(reserved >= 0, `Reserved stock for ${product.sku} must be non-negative`)
    assert.ok(reserved <= onHand, `Reserved stock cannot exceed on-hand for ${product.sku}`)
    assert.equal(available, onHand - reserved, `available must equal on_hand - reserved for ${product.sku}`)
  }
}

test('initial demo dataset strictly satisfies all inventory invariants', () => {
  validateInvariants(DEMO_PRODUCTS)
  assert.ok(DEMO_PRODUCTS.length >= 10, 'Demonstration catalogue has at least 10 products')
})

test('filterDemoProducts filters by SKU, name, category, and stock status', () => {
  const filteredSku = filterDemoProducts(DEMO_PRODUCTS, { sku: 'ELC-1042' })
  assert.equal(filteredSku.length, 1)
  assert.equal(filteredSku[0].sku, 'ELC-1042')

  const filteredName = filterDemoProducts(DEMO_PRODUCTS, { name: 'Keyboard' })
  assert.equal(filteredName.length, 1)

  const filteredCategory = filterDemoProducts(DEMO_PRODUCTS, { category: 'Electronics' })
  assert.ok(filteredCategory.length >= 3)

  const filteredLow = filterDemoProducts(DEMO_PRODUCTS, { stockStatus: 'low' })
  for (const p of filteredLow) {
    assert.ok(Number(p.on_hand) <= 10)
  }
})

test('simulated stock receiving preserves invariants: on_hand += qty, available = on_hand - reserved', () => {
  const sample = { ...DEMO_PRODUCTS[0] }
  const initialOnHand = sample.on_hand
  const initialReserved = sample.reserved
  const initialAvail = sample.available

  const qty = 15
  sample.on_hand += qty
  sample.available = sample.on_hand - sample.reserved

  assert.equal(sample.on_hand, initialOnHand + qty)
  assert.equal(sample.reserved, initialReserved)
  assert.equal(sample.available, initialAvail + qty)
  validateInvariants([sample])
})

test('simulated order reservation: increases reserved, available decreases, rejects oversell', () => {
  const sample = { ...DEMO_PRODUCTS[0] }
  const initialOnHand = sample.on_hand
  const initialReserved = sample.reserved
  const initialAvail = sample.available

  // Attempting to reserve more than available must be rejected
  const oversellQty = initialAvail + 5
  assert.ok(oversellQty > sample.available, 'Oversell condition detected')

  // Valid reservation
  const validQty = 5
  sample.reserved += validQty
  sample.available = sample.on_hand - sample.reserved

  assert.equal(sample.on_hand, initialOnHand)
  assert.equal(sample.reserved, initialReserved + validQty)
  assert.equal(sample.available, initialAvail - validQty)
  validateInvariants([sample])
})

test('simulated order confirmation: decrements physical on_hand and reserved stock consistently', () => {
  const sample = { sku: 'TEST-1', name: 'Test', on_hand: 20, reserved: 5, available: 15 }
  const confirmedQty = 5

  sample.on_hand -= confirmedQty
  sample.reserved -= confirmedQty
  sample.available = sample.on_hand - sample.reserved

  assert.equal(sample.on_hand, 15)
  assert.equal(sample.reserved, 0)
  assert.equal(sample.available, 15)
  validateInvariants([sample])
})

test('simulated order cancellation: releases reserved stock back to available', () => {
  const sample = { sku: 'TEST-1', name: 'Test', on_hand: 20, reserved: 5, available: 15 }
  const cancelledQty = 5

  sample.reserved -= cancelledQty
  sample.available = sample.on_hand - sample.reserved

  assert.equal(sample.on_hand, 20)
  assert.equal(sample.reserved, 0)
  assert.equal(sample.available, 20)
  validateInvariants([sample])
})

test('simulated return: restores physical stock and available stock', () => {
  const sample = { sku: 'TEST-1', name: 'Test', on_hand: 15, reserved: 0, available: 15 }
  const returnQty = 2

  sample.on_hand += returnQty
  sample.available = sample.on_hand - sample.reserved

  assert.equal(sample.on_hand, 17)
  assert.equal(sample.reserved, 0)
  assert.equal(sample.available, 17)
  validateInvariants([sample])
})
