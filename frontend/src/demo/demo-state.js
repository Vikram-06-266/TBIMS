import { useState, useCallback, useMemo } from 'react'
import {
  DEMO_PRODUCTS,
  DEMO_ORDERS,
  DEMO_MOVEMENTS,
  DEMO_AUDIT_LOG,
  LOW_STOCK_THRESHOLD,
} from './demo-data.js'

function deepClone(data) {
  return JSON.parse(JSON.stringify(data))
}

function validateInvariants(products) {
  for (const product of products) {
    const onHand = Number(product.on_hand)
    const reserved = Number(product.reserved)
    const available = Number(product.available)

    if (onHand < 0) {
      throw new Error(`Invariant violation: On-hand stock for SKU ${product.sku} cannot be negative (${onHand}).`)
    }
    if (reserved < 0) {
      throw new Error(`Invariant violation: Reserved stock for SKU ${product.sku} cannot be negative (${reserved}).`)
    }
    if (reserved > onHand) {
      throw new Error(`Invariant violation: Reserved stock (${reserved}) exceeds on-hand stock (${onHand}) for SKU ${product.sku}.`)
    }
    if (available !== onHand - reserved) {
      throw new Error(`Invariant violation: Available stock (${available}) must equal on_hand (${onHand}) - reserved (${reserved}) for SKU ${product.sku}.`)
    }
  }
}

export function useDemoState() {
  const [products, setProducts] = useState(() => deepClone(DEMO_PRODUCTS))
  const [orders, setOrders] = useState(() => deepClone(DEMO_ORDERS))
  const [movements, setMovements] = useState(() => deepClone(DEMO_MOVEMENTS))
  const [auditLog, setAuditLog] = useState(() => deepClone(DEMO_AUDIT_LOG))

  // Invariant verification on initial load
  useMemo(() => {
    validateInvariants(products)
  }, [products])

  const totals = useMemo(() => {
    let totalOnHand = 0
    let totalReserved = 0
    let totalAvailable = 0
    let lowStockCount = 0

    for (const p of products) {
      const onHand = Number(p.on_hand) || 0
      const reserved = Number(p.reserved) || 0
      const available = Number(p.available) || 0

      totalOnHand += onHand
      totalReserved += reserved
      totalAvailable += available
      if (onHand <= LOW_STOCK_THRESHOLD) {
        lowStockCount += 1
      }
    }

    return {
      products: products.length,
      onHand: totalOnHand,
      reserved: totalReserved,
      available: totalAvailable,
      lowStock: lowStockCount,
    }
  }, [products])

  const categories = useMemo(() => {
    return [...new Set(products.map((p) => p.category).filter(Boolean))].sort()
  }, [products])

  // Operation: Receive stock
  const receiveStock = useCallback(({ productSku, quantity, performedBy = 'manager', reference = '' }) => {
    const qty = parseInt(quantity, 10)
    if (!Number.isInteger(qty) || qty <= 0) {
      throw new Error('Received quantity must be a positive integer.')
    }

    let updatedProduct = null
    const timestamp = new Date().toISOString()

    setProducts((currentProducts) => {
      const targetIndex = currentProducts.findIndex((p) => p.sku === productSku)
      if (targetIndex === -1) {
        throw new Error(`Product with SKU "${productSku}" not found in catalogue.`)
      }

      const target = currentProducts[targetIndex]
      const newOnHand = target.on_hand + qty
      const newAvailable = newOnHand - target.reserved

      updatedProduct = {
        ...target,
        on_hand: newOnHand,
        available: newAvailable,
      }

      const nextProducts = [...currentProducts]
      nextProducts[targetIndex] = updatedProduct
      validateInvariants(nextProducts)
      return nextProducts
    })

    setMovements((currentMovements) => [
      {
        id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'PURCHASE',
        productSku,
        productName: updatedProduct?.name || productSku,
        quantityChange: qty,
        availableAfter: updatedProduct ? updatedProduct.available : 0,
        performedBy,
        createdAt: timestamp,
        description: reference ? `Stock received (Ref: ${reference})` : 'Stock intake received into inventory',
      },
      ...currentMovements,
    ])

    setAuditLog((currentAudit) => [
      {
        id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        action: 'STOCK_RECEIVED',
        details: `Received ${qty} units of "${updatedProduct?.name}" (SKU: ${productSku}). New on-hand: ${updatedProduct?.on_hand}.`,
        performedBy,
        createdAt: timestamp,
      },
      ...currentAudit,
    ])

    return updatedProduct
  }, [])

  // Operation: Reserve stock and create pending order
  const reserveStockAndCreateOrder = useCallback(({ customerName, items, performedBy = 'staff' }) => {
    if (!customerName || !customerName.trim()) {
      throw new Error('Customer name is required.')
    }
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('At least one product item is required to place an order.')
    }

    const timestamp = new Date().toISOString()
    const orderNumber = `ORD-2026-${String(Math.floor(100 + Math.random() * 900))}`
    let newOrder = null
    const updatedProductsMap = new Map()

    setProducts((currentProducts) => {
      const nextProducts = deepClone(currentProducts)

      for (const item of items) {
        const qty = parseInt(item.quantity, 10)
        if (!Number.isInteger(qty) || qty <= 0) {
          throw new Error(`Invalid quantity for SKU "${item.productSku}". Must be a positive integer.`)
        }

        const product = nextProducts.find((p) => p.sku === item.productSku)
        if (!product) {
          throw new Error(`Product with SKU "${item.productSku}" not found.`)
        }

        if (qty > product.available) {
          throw new Error(
            `Insufficient available stock for "${product.name}" (SKU: ${product.sku}). Requested: ${qty}, Available: ${product.available}.`
          )
        }

        product.reserved += qty
        product.available = product.on_hand - product.reserved
        updatedProductsMap.set(product.sku, product)
      }

      validateInvariants(nextProducts)
      return nextProducts
    })

    const orderItems = items.map((item) => {
      const prod = updatedProductsMap.get(item.productSku) || products.find((p) => p.sku === item.productSku)
      const qty = parseInt(item.quantity, 10)
      const unitPrice = prod?.unit_price || '0.00'
      return {
        productSku: item.productSku,
        productName: prod?.name || item.productSku,
        quantity: qty,
        unitPrice,
      }
    })

    const totalAmount = orderItems
      .reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0)
      .toFixed(2)

    newOrder = {
      id: `ord-${Date.now()}`,
      orderNumber,
      customerName: customerName.trim(),
      status: 'PENDING',
      items: orderItems,
      totalAmount,
      createdAt: timestamp,
      updatedAt: timestamp,
      placedBy: performedBy,
    }

    setOrders((currentOrders) => [newOrder, ...currentOrders])

    setMovements((currentMovements) => {
      const newMovs = orderItems.map((item) => {
        const prod = updatedProductsMap.get(item.productSku)
        return {
          id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: 'SALE',
          productSku: item.productSku,
          productName: item.productName,
          quantityChange: 0, // reserved, not yet consumed
          availableAfter: prod ? prod.available : 0,
          performedBy,
          createdAt: timestamp,
          description: `Reserved ${item.quantity} unit(s) for ${orderNumber} (${customerName.trim()})`,
        }
      })
      return [...newMovs, ...currentMovements]
    })

    setAuditLog((currentAudit) => [
      {
        id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        action: 'ORDER_CREATED',
        details: `Created order ${orderNumber} for ${customerName.trim()} with ${orderItems.length} line item(s). Total: ₹${totalAmount}.`,
        performedBy,
        createdAt: timestamp,
      },
      ...currentAudit,
    ])

    return newOrder
  }, [products])

  // Operation: Confirm Order (consume reservation and decrement physical stock)
  const confirmOrder = useCallback(({ orderId, performedBy = 'staff' }) => {
    const timestamp = new Date().toISOString()
    const targetOrder = orders.find((o) => o.id === orderId)
    if (!targetOrder) {
      throw new Error(`Order with ID "${orderId}" not found.`)
    }
    if (targetOrder.status !== 'PENDING') {
      throw new Error(`Order ${targetOrder.orderNumber} cannot be confirmed because it is in "${targetOrder.status}" status (must be PENDING).`)
    }

    const confirmedOrder = {
      ...targetOrder,
      status: 'CONFIRMED',
      updatedAt: timestamp,
    }

    setOrders((currentOrders) => {
      const targetIndex = currentOrders.findIndex((o) => o.id === orderId)
      if (targetIndex === -1) return currentOrders
      const nextOrders = [...currentOrders]
      nextOrders[targetIndex] = confirmedOrder
      return nextOrders
    })

    // Consume stock in products: on_hand -= qty, reserved -= qty, available unchanged
    setProducts((currentProducts) => {
      const nextProducts = deepClone(currentProducts)

      for (const item of confirmedOrder.items) {
        const product = nextProducts.find((p) => p.sku === item.productSku)
        if (product) {
          product.on_hand -= item.quantity
          product.reserved -= item.quantity
          product.available = product.on_hand - product.reserved
        }
      }

      validateInvariants(nextProducts)
      return nextProducts
    })

    setMovements((currentMovements) => {
      const newMovs = confirmedOrder.items.map((item) => ({
        id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'SALE',
        productSku: item.productSku,
        productName: item.productName,
        quantityChange: -item.quantity,
        availableAfter: (products.find((p) => p.sku === item.productSku)?.available ?? 0),
        performedBy,
        createdAt: timestamp,
        description: `Fulfilled ${item.quantity} unit(s) for confirmed order ${confirmedOrder.orderNumber}`,
      }))
      return [...newMovs, ...currentMovements]
    })

    setAuditLog((currentAudit) => [
      {
        id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        action: 'ORDER_CONFIRMED',
        details: `Confirmed order ${confirmedOrder.orderNumber} for ${confirmedOrder.customerName}. Stock consumed.`,
        performedBy,
        createdAt: timestamp,
      },
      ...currentAudit,
    ])

    return confirmedOrder
  }, [orders, products])

  // Operation: Cancel Order (release reservations)
  const cancelOrder = useCallback(({ orderId, performedBy = 'staff' }) => {
    const timestamp = new Date().toISOString()
    const targetOrder = orders.find((o) => o.id === orderId)
    if (!targetOrder) {
      throw new Error(`Order with ID "${orderId}" not found.`)
    }
    if (targetOrder.status !== 'PENDING') {
      throw new Error(`Order ${targetOrder.orderNumber} cannot be cancelled because it is already "${targetOrder.status}".`)
    }

    const cancelledOrder = {
      ...targetOrder,
      status: 'CANCELLED',
      updatedAt: timestamp,
    }

    setOrders((currentOrders) => {
      const targetIndex = currentOrders.findIndex((o) => o.id === orderId)
      if (targetIndex === -1) return currentOrders
      const nextOrders = [...currentOrders]
      nextOrders[targetIndex] = cancelledOrder
      return nextOrders
    })

    // Release reserved stock: reserved -= qty, available = on_hand - reserved
    setProducts((currentProducts) => {
      const nextProducts = deepClone(currentProducts)

      for (const item of cancelledOrder.items) {
        const product = nextProducts.find((p) => p.sku === item.productSku)
        if (product) {
          product.reserved -= item.quantity
          product.available = product.on_hand - product.reserved
        }
      }

      validateInvariants(nextProducts)
      return nextProducts
    })

    setMovements((currentMovements) => {
      const newMovs = cancelledOrder.items.map((item) => ({
        id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'ADJUSTMENT',
        productSku: item.productSku,
        productName: item.productName,
        quantityChange: 0,
        availableAfter: (products.find((p) => p.sku === item.productSku)?.available ?? 0) + item.quantity,
        performedBy,
        createdAt: timestamp,
        description: `Released ${item.quantity} reserved unit(s) from cancelled order ${cancelledOrder.orderNumber}`,
      }))
      return [...newMovs, ...currentMovements]
    })

    setAuditLog((currentAudit) => [
      {
        id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        action: 'ORDER_CANCELLED',
        details: `Cancelled order ${cancelledOrder.orderNumber}. All reserved items released back to available inventory.`,
        performedBy,
        createdAt: timestamp,
      },
      ...currentAudit,
    ])

    return cancelledOrder
  }, [orders, products])

  // Operation: Process a return on a confirmed or completed order
  const processReturn = useCallback(({ orderId, productSku, quantity, reason = 'Customer return', performedBy = 'manager' }) => {
    const qty = parseInt(quantity, 10)
    if (!Number.isInteger(qty) || qty <= 0) {
      throw new Error('Return quantity must be a positive integer.')
    }

    const order = orders.find((o) => o.id === orderId)
    if (!order) {
      throw new Error(`Order with ID "${orderId}" not found.`)
    }
    if (order.status !== 'CONFIRMED' && order.status !== 'COMPLETED') {
      throw new Error(`Returns can only be processed on CONFIRMED or COMPLETED orders (order status is "${order.status}").`)
    }

    const orderItem = order.items.find((i) => i.productSku === productSku)
    if (!orderItem) {
      throw new Error(`Product ${productSku} is not part of order ${order.orderNumber}.`)
    }
    if (qty > orderItem.quantity) {
      throw new Error(`Return quantity (${qty}) cannot exceed the ordered quantity (${orderItem.quantity}).`)
    }

    const timestamp = new Date().toISOString()
    let updatedProduct = null

    setProducts((currentProducts) => {
      const nextProducts = deepClone(currentProducts)
      const product = nextProducts.find((p) => p.sku === productSku)
      if (!product) {
        throw new Error(`Product ${productSku} not found.`)
      }

      product.on_hand += qty
      product.available = product.on_hand - product.reserved
      updatedProduct = product

      validateInvariants(nextProducts)
      return nextProducts
    })

    setMovements((currentMovements) => [
      {
        id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'RETURN',
        productSku,
        productName: orderItem.productName,
        quantityChange: qty,
        availableAfter: (updatedProduct ? updatedProduct.available : 0),
        performedBy,
        createdAt: timestamp,
        description: `Returned ${qty} unit(s) from order ${order.orderNumber}. Reason: ${reason}`,
      },
      ...currentMovements,
    ])

    setAuditLog((currentAudit) => [
      {
        id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        action: 'RETURN_PROCESSED',
        details: `Processed return of ${qty} unit(s) of ${orderItem.productName} for order ${order.orderNumber}. Reason: ${reason}.`,
        performedBy,
        createdAt: timestamp,
      },
      ...currentAudit,
    ])

    return updatedProduct
  }, [orders])

  // Operation: Add product to catalogue
  const addProduct = useCallback(({ sku, name, category = null, unit_price, on_hand = 0, reserved = 0 }) => {
    const trimmedSku = (sku || '').trim().toUpperCase()
    const trimmedName = (name || '').trim()
    const priceNum = Number(unit_price)

    if (!trimmedSku) throw new Error('Product SKU is required.')
    if (!trimmedName) throw new Error('Product name is required.')
    if (isNaN(priceNum) || priceNum < 0) throw new Error('Unit price must be a non-negative number.')

    const parsedOnHand = Math.max(0, parseInt(on_hand, 10) || 0)
    const parsedReserved = Math.max(0, parseInt(reserved, 10) || 0)
    if (parsedReserved > parsedOnHand) {
      throw new Error('Initial reserved stock cannot exceed initial on-hand stock.')
    }

    let newProduct = null
    const timestamp = new Date().toISOString()

    setProducts((currentProducts) => {
      if (currentProducts.some((p) => p.sku.toUpperCase() === trimmedSku)) {
        throw new Error(`A product with SKU "${trimmedSku}" already exists.`)
      }

      newProduct = {
        id: `demo-${Date.now()}`,
        sku: trimmedSku,
        name: trimmedName,
        category: category ? category.trim() : null,
        unit_price: priceNum.toFixed(2),
        on_hand: parsedOnHand,
        reserved: parsedReserved,
        available: parsedOnHand - parsedReserved,
      }

      const nextProducts = [newProduct, ...currentProducts]
      validateInvariants(nextProducts)
      return nextProducts
    })

    setAuditLog((currentAudit) => [
      {
        id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        action: 'PRODUCT_CREATED',
        details: `Added new product "${trimmedName}" (SKU: ${trimmedSku}) to catalogue at ₹${priceNum.toFixed(2)}.`,
        performedBy: 'admin',
        createdAt: timestamp,
      },
      ...currentAudit,
    ])

    return newProduct
  }, [])

  // Operation: Update product non-stock details (name, category, price)
  const updateProduct = useCallback(({ sku, name, category, unit_price }) => {
    const trimmedName = (name || '').trim()
    const priceNum = Number(unit_price)

    if (!trimmedName) throw new Error('Product name is required.')
    if (isNaN(priceNum) || priceNum < 0) throw new Error('Unit price must be a non-negative number.')

    let updated = null
    const timestamp = new Date().toISOString()

    setProducts((currentProducts) => {
      const targetIndex = currentProducts.findIndex((p) => p.sku === sku)
      if (targetIndex === -1) {
        throw new Error(`Product with SKU "${sku}" not found.`)
      }

      const target = currentProducts[targetIndex]
      updated = {
        ...target,
        name: trimmedName,
        category: category ? category.trim() : null,
        unit_price: priceNum.toFixed(2),
      }

      const nextProducts = [...currentProducts]
      nextProducts[targetIndex] = updated
      return nextProducts
    })

    setAuditLog((currentAudit) => [
      {
        id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        action: 'PRODUCT_UPDATED',
        details: `Updated details for product ${sku} ("${trimmedName}", ₹${priceNum.toFixed(2)}).`,
        performedBy: 'admin',
        createdAt: timestamp,
      },
      ...currentAudit,
    ])

    return updated
  }, [])

  // Operation: Reset demo data
  const resetDemoData = useCallback(() => {
    const freshProducts = deepClone(DEMO_PRODUCTS)
    const freshOrders = deepClone(DEMO_ORDERS)
    const freshMovements = deepClone(DEMO_MOVEMENTS)
    const freshAudit = deepClone(DEMO_AUDIT_LOG)

    validateInvariants(freshProducts)

    setProducts(freshProducts)
    setOrders(freshOrders)
    setMovements(freshMovements)
    setAuditLog(freshAudit)

    return true
  }, [])

  return {
    products,
    orders,
    movements,
    auditLog,
    totals,
    categories,
    receiveStock,
    reserveStockAndCreateOrder,
    confirmOrder,
    cancelOrder,
    processReturn,
    addProduct,
    updateProduct,
    resetDemoData,
  }
}
