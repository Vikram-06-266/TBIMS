export const DEMO_USERS = [
  { username: 'owner', role: 'owner', display: 'Store Owner', description: 'Full system oversight, catalogue management, and audit access.' },
  { username: 'admin', role: 'admin', display: 'System Administrator', description: 'System configuration, inventory control, and user oversight.' },
  { username: 'manager', role: 'inventoryManager', display: 'Inventory Manager', description: 'Stock receiving, inventory adjustments, and returns processing.' },
  { username: 'staff', role: 'staff', display: 'Retail Staff', description: 'Product search, customer order creation, and transaction tracking.' },
  { username: 'customer', role: 'customer', display: 'Customer View', description: 'Public product browsing and stock availability check.' },
]

export const LOW_STOCK_THRESHOLD = 10

export const DEMO_PRODUCTS = [
  {
    id: 'demo-1',
    sku: 'ELC-1042',
    name: 'Wireless Keyboard',
    category: 'Electronics',
    unit_price: '2499.00',
    on_hand: 42,
    reserved: 8,
    available: 34,
  },
  {
    id: 'demo-2',
    sku: 'HOM-2081',
    name: 'Ceramic Table Lamp',
    category: 'Home & Living',
    unit_price: '1899.00',
    on_hand: 26,
    reserved: 4,
    available: 22,
  },
  {
    id: 'demo-3',
    sku: 'OFF-3105',
    name: 'Hardcover Notebook Set',
    category: 'Stationery',
    unit_price: '649.00',
    on_hand: 115,
    reserved: 12,
    available: 103,
  },
  {
    id: 'demo-4',
    sku: 'ELC-1168',
    name: 'USB-C Desk Hub',
    category: 'Electronics',
    unit_price: '3299.00',
    on_hand: 18,
    reserved: 3,
    available: 15,
  },
  {
    id: 'demo-5',
    sku: 'KIT-4022',
    name: 'Insulated Travel Mug',
    category: 'Kitchen',
    unit_price: '1199.00',
    on_hand: 64,
    reserved: 9,
    available: 55,
  },
  {
    id: 'demo-6',
    sku: 'HOM-2140',
    name: 'Woven Storage Basket',
    category: 'Home & Living',
    unit_price: '899.00',
    on_hand: 31,
    reserved: 5,
    available: 26,
  },
  {
    id: 'demo-7',
    sku: 'ELC-1205',
    name: 'Noise-Cancelling Headphones',
    category: 'Electronics',
    unit_price: '7499.00',
    on_hand: 8,
    reserved: 3,
    available: 5,
  },
  {
    id: 'demo-8',
    sku: 'OFF-3220',
    name: 'Ergonomic Gel Mousepad',
    category: 'Stationery',
    unit_price: '499.00',
    on_hand: 5,
    reserved: 2,
    available: 3,
  },
  {
    id: 'demo-9',
    sku: 'KIT-4110',
    name: 'Cast Iron Skillet (10-inch)',
    category: 'Kitchen',
    unit_price: '2150.00',
    on_hand: 14,
    reserved: 0,
    available: 14,
  },
  {
    id: 'demo-10',
    sku: 'HDW-5012',
    name: 'Precision Screwdriver Set',
    category: 'Hardware',
    unit_price: '1299.00',
    on_hand: 4,
    reserved: 1,
    available: 3,
  },
  {
    id: 'demo-11',
    sku: 'HDW-5045',
    name: 'Heavy Duty Steel Measuring Tape (5m)',
    category: 'Hardware',
    unit_price: '349.00',
    on_hand: 50,
    reserved: 6,
    available: 44,
  },
  {
    id: 'demo-12',
    sku: 'HOM-2290',
    name: 'Aromatherapy Oil Diffuser',
    category: 'Home & Living',
    unit_price: '1599.00',
    on_hand: 22,
    reserved: 4,
    available: 18,
  },
]

export const DEMO_ORDERS = [
  {
    id: 'ord-101',
    orderNumber: 'ORD-2026-001',
    customerName: 'Aarav Sharma',
    status: 'CONFIRMED',
    items: [
      { productSku: 'ELC-1042', productName: 'Wireless Keyboard', quantity: 2, unitPrice: '2499.00' },
      { productSku: 'ELC-1168', productName: 'USB-C Desk Hub', quantity: 1, unitPrice: '3299.00' },
    ],
    totalAmount: '8297.00',
    createdAt: '2026-11-18T10:15:00Z',
    updatedAt: '2026-11-18T10:30:00Z',
    placedBy: 'staff',
  },
  {
    id: 'ord-102',
    orderNumber: 'ORD-2026-002',
    customerName: 'Priya Patel',
    status: 'PENDING',
    items: [
      { productSku: 'HOM-2081', productName: 'Ceramic Table Lamp', quantity: 2, unitPrice: '1899.00' },
    ],
    totalAmount: '3798.00',
    createdAt: '2026-11-19T09:20:00Z',
    updatedAt: '2026-11-19T09:20:00Z',
    placedBy: 'staff',
  },
  {
    id: 'ord-103',
    orderNumber: 'ORD-2026-003',
    customerName: 'Rohan Mehta',
    status: 'PENDING',
    items: [
      { productSku: 'ELC-1205', productName: 'Noise-Cancelling Headphones', quantity: 1, unitPrice: '7499.00' },
      { productSku: 'OFF-3105', productName: 'Hardcover Notebook Set', quantity: 3, unitPrice: '649.00' },
    ],
    totalAmount: '9446.00',
    createdAt: '2026-11-19T11:45:00Z',
    updatedAt: '2026-11-19T11:45:00Z',
    placedBy: 'manager',
  },
  {
    id: 'ord-104',
    orderNumber: 'ORD-2026-004',
    customerName: 'Ananya Verma',
    status: 'COMPLETED',
    items: [
      { productSku: 'KIT-4022', productName: 'Insulated Travel Mug', quantity: 4, unitPrice: '1199.00' },
    ],
    totalAmount: '4796.00',
    createdAt: '2026-11-17T14:10:00Z',
    updatedAt: '2026-11-17T16:00:00Z',
    placedBy: 'staff',
  },
  {
    id: 'ord-105',
    orderNumber: 'ORD-2026-005',
    customerName: 'Vikram Joshi',
    status: 'CANCELLED',
    items: [
      { productSku: 'HDW-5012', productName: 'Precision Screwdriver Set', quantity: 2, unitPrice: '1299.00' },
    ],
    totalAmount: '2598.00',
    createdAt: '2026-11-18T16:30:00Z',
    updatedAt: '2026-11-18T17:00:00Z',
    placedBy: 'staff',
  },
]

export const DEMO_MOVEMENTS = [
  {
    id: 'mov-1',
    type: 'OPENING',
    productSku: 'ELC-1042',
    productName: 'Wireless Keyboard',
    quantityChange: 50,
    availableAfter: 42,
    performedBy: 'owner',
    createdAt: '2026-11-15T08:00:00Z',
    description: 'Initial stock intake from supplier inventory',
  },
  {
    id: 'mov-2',
    type: 'PURCHASE',
    productSku: 'OFF-3105',
    productName: 'Hardcover Notebook Set',
    quantityChange: 120,
    availableAfter: 110,
    performedBy: 'manager',
    createdAt: '2026-11-16T11:30:00Z',
    description: 'Bulk delivery PO-8832',
  },
  {
    id: 'mov-3',
    type: 'SALE',
    productSku: 'KIT-4022',
    productName: 'Insulated Travel Mug',
    quantityChange: -4,
    availableAfter: 55,
    performedBy: 'staff',
    createdAt: '2026-11-17T16:00:00Z',
    description: 'Order ORD-2026-004 fulfilled',
  },
  {
    id: 'mov-4',
    type: 'SALE',
    productSku: 'ELC-1042',
    productName: 'Wireless Keyboard',
    quantityChange: -2,
    availableAfter: 35,
    performedBy: 'staff',
    createdAt: '2026-11-18T10:30:00Z',
    description: 'Order ORD-2026-001 confirmed',
  },
  {
    id: 'mov-5',
    type: 'SALE',
    productSku: 'ELC-1168',
    productName: 'USB-C Desk Hub',
    quantityChange: -1,
    availableAfter: 15,
    performedBy: 'staff',
    createdAt: '2026-11-18T10:30:00Z',
    description: 'Order ORD-2026-001 confirmed',
  },
  {
    id: 'mov-6',
    type: 'ADJUSTMENT',
    productSku: 'HDW-5012',
    productName: 'Precision Screwdriver Set',
    quantityChange: 0,
    availableAfter: 3,
    performedBy: 'staff',
    createdAt: '2026-11-18T17:00:00Z',
    description: 'Order ORD-2026-005 cancelled: released 2 reserved units',
  },
  {
    id: 'mov-7',
    type: 'PURCHASE',
    productSku: 'HDW-5045',
    productName: 'Heavy Duty Steel Measuring Tape (5m)',
    quantityChange: 50,
    availableAfter: 44,
    performedBy: 'manager',
    createdAt: '2026-11-19T08:15:00Z',
    description: 'Stock batch received from TechTools Ltd',
  },
  {
    id: 'mov-8',
    type: 'RETURN',
    productSku: 'HOM-2140',
    productName: 'Woven Storage Basket',
    quantityChange: 2,
    availableAfter: 26,
    performedBy: 'manager',
    createdAt: '2026-11-19T09:45:00Z',
    description: 'Customer return accepted for order ORD-2026-000',
  },
]

export const DEMO_AUDIT_LOG = [
  {
    id: 'aud-1',
    action: 'SYSTEM_INITIALIZED',
    details: 'TBIMS demo environment started with 12 baseline catalogue products.',
    performedBy: 'owner',
    createdAt: '2026-11-15T08:00:00Z',
  },
  {
    id: 'aud-2',
    action: 'STOCK_RECEIVED',
    details: 'Received 120 units of Hardcover Notebook Set (SKU: OFF-3105).',
    performedBy: 'manager',
    createdAt: '2026-11-16T11:30:00Z',
  },
  {
    id: 'aud-3',
    action: 'ORDER_CONFIRMED',
    details: 'Order ORD-2026-004 confirmed for Ananya Verma. Stock decremented.',
    performedBy: 'staff',
    createdAt: '2026-11-17T16:00:00Z',
  },
  {
    id: 'aud-4',
    action: 'ORDER_CREATED',
    details: 'Order ORD-2026-001 created. Reserved 2 ELC-1042 and 1 ELC-1168.',
    performedBy: 'staff',
    createdAt: '2026-11-18T10:15:00Z',
  },
  {
    id: 'aud-5',
    action: 'ORDER_CONFIRMED',
    details: 'Order ORD-2026-001 confirmed. 3 total units consumed.',
    performedBy: 'staff',
    createdAt: '2026-11-18T10:30:00Z',
  },
  {
    id: 'aud-6',
    action: 'ORDER_CANCELLED',
    details: 'Order ORD-2026-005 cancelled. 2 reserved units released for HDW-5012.',
    performedBy: 'staff',
    createdAt: '2026-11-18T17:00:00Z',
  },
  {
    id: 'aud-7',
    action: 'STOCK_RECEIVED',
    details: 'Received 50 units of Heavy Duty Steel Measuring Tape (SKU: HDW-5045).',
    performedBy: 'manager',
    createdAt: '2026-11-19T08:15:00Z',
  },
  {
    id: 'aud-8',
    action: 'RETURN_PROCESSED',
    details: 'Returned 2 units of Woven Storage Basket (SKU: HOM-2140) to inventory.',
    performedBy: 'manager',
    createdAt: '2026-11-19T09:45:00Z',
  },
]

export function filterDemoProducts(products, filters) {
  const skuQuery = (filters.sku || '').trim().toLocaleLowerCase()
  const nameQuery = (filters.name || '').trim().toLocaleLowerCase()
  const categoryQuery = (filters.category || '').trim().toLocaleLowerCase()
  const stockStatus = filters.stockStatus || ''

  return products.filter((product) => {
    const skuMatches = !skuQuery || product.sku.toLocaleLowerCase().includes(skuQuery)
    const nameMatches = !nameQuery || product.name.toLocaleLowerCase().includes(nameQuery)
    const categoryMatches =
      !categoryQuery || (product.category || '').toLocaleLowerCase() === categoryQuery

    let stockMatches = true
    if (stockStatus === 'low') {
      stockMatches = Number(product.on_hand) <= LOW_STOCK_THRESHOLD
    } else if (stockStatus === 'out') {
      stockMatches = Number(product.available) <= 0
    } else if (stockStatus === 'in') {
      stockMatches = Number(product.available) > 0
    }

    return skuMatches && nameMatches && categoryMatches && stockMatches
  })
}
