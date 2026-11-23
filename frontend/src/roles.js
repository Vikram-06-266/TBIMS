export const DEFAULT_PREVIEW_ROLE = 'admin'

export const ROLE_DETAILS = {
  owner: {
    label: 'Owner',
    description: 'Full application and inventory overview.',
  },
  admin: {
    label: 'Admin',
    description: 'System and inventory overview.',
  },
  inventoryManager: {
    label: 'Inventory Manager',
    description: 'Product availability and stock operations.',
  },
  staff: {
    label: 'Staff',
    description: 'Product search and transaction workspace.',
  },
  customer: {
    label: 'Customer',
    description: 'Customer store, product catalogue, shopping cart, and order tracking.',
  },
}

export const ROLE_NAVIGATION = {
  owner: [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { id: 'products', label: 'Products', icon: 'box' },
    { id: 'stock-receiving', label: 'Stock Receiving', icon: 'packagePlus' },
    { id: 'transactions', label: 'Transactions', icon: 'receipt' },
    { id: 'returns', label: 'Returns', icon: 'return' },
    { id: 'reports', label: 'Reports', icon: 'chart' },
    { id: 'user-management', label: 'User Management', icon: 'users' },
    { id: 'audit-logs', label: 'Audit Logs', icon: 'history' },
  ],
  admin: [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { id: 'products', label: 'Products', icon: 'box' },
    { id: 'stock-receiving', label: 'Stock Receiving', icon: 'packagePlus' },
    { id: 'transactions', label: 'Transactions', icon: 'receipt' },
    { id: 'returns', label: 'Returns', icon: 'return' },
    { id: 'reports', label: 'Reports', icon: 'chart' },
    { id: 'user-management', label: 'User Management', icon: 'users' },
    { id: 'audit-logs', label: 'Audit Logs', icon: 'history' },
  ],
  inventoryManager: [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { id: 'products', label: 'Products', icon: 'box' },
    { id: 'inventory', label: 'Inventory', icon: 'layers' },
    { id: 'stock-receiving', label: 'Stock Receiving', icon: 'packagePlus' },
    { id: 'transactions', label: 'Transactions', icon: 'receipt' },
    { id: 'returns', label: 'Returns', icon: 'return' },
    { id: 'reports', label: 'Reports', icon: 'chart' },
  ],
  staff: [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { id: 'products', label: 'Products', icon: 'box' },
    { id: 'new-transaction', label: 'New Transaction', icon: 'plus' },
    { id: 'my-transactions', label: 'My Transactions', icon: 'receipt' },
  ],
  customer: [
    { id: 'shop', label: 'Shop Catalogue', icon: 'box' },
    { id: 'cart', label: 'Shopping Cart', icon: 'cart' },
    { id: 'my-orders', label: 'My Orders', icon: 'receipt' },
  ],
}

export const UNAVAILABLE_PAGES = {
  inventory: {
    title: 'Inventory operations',
    description: 'Stock receiving and movement workflows are not connected yet.',
    dependency: 'Waiting for the approved stock operations API and P1 integration.',
  },
  transactions: {
    title: 'Transactions',
    description: 'Order and reservation management is not connected yet.',
    dependency: 'Waiting for the approved order and reservation APIs.',
  },
  reports: {
    title: 'Reports',
    description: 'Inventory and performance reports are not connected yet.',
    dependency: 'Reports must use measured data from the approved API or P3 output.',
  },
  'user-management': {
    title: 'User management',
    description: 'User and role administration is not available in the dashboard.',
    dependency: 'Accounts are provisioned by the administrator; no user-management API is connected.',
  },
  'audit-logs': {
    title: 'Audit logs',
    description: 'Audit history is not connected yet.',
    dependency: 'Waiting for the approved audit API and actor/permission requirements.',
  },
  'stock-receiving': {
    title: 'Stock receiving',
    description: 'Receiving stock cannot be submitted from this dashboard.',
    dependency: 'Waiting for the approved stock-receive API and P1 operation.',
  },
  returns: {
    title: 'Returns',
    description: 'Return processing is not connected yet.',
    dependency: 'Waiting for the approved return API and P1 transaction operation.',
  },
  'new-transaction': {
    title: 'New transaction',
    description: 'Transactions cannot be created from this dashboard yet.',
    dependency: 'Waiting for the approved order and reservation APIs.',
  },
  'my-transactions': {
    title: 'My transactions',
    description: 'There is no transaction history API.',
    dependency: 'Sign-in identifies the staff user, but the approved transaction history API is pending.',
  },
}
