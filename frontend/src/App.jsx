import { useCallback, useEffect, useState } from 'react'
import AddProductDialog from './components/AddProductDialog.jsx'
import ProductDetailDialog from './components/ProductDetailDialog.jsx'
import DashboardView from './components/DashboardView.jsx'
import Icon from './components/Icon.jsx'
import ProductFilters from './components/ProductFilters.jsx'
import ProductsTable from './components/ProductsTable.jsx'
import Sidebar from './components/Sidebar.jsx'
import SignInView from './components/SignInView.jsx'
import TopBar from './components/TopBar.jsx'
import UnavailablePage from './components/UnavailablePage.jsx'
import StockReceivingView from './components/StockReceivingView.jsx'
import TransactionsView from './components/TransactionsView.jsx'
import ReturnsView from './components/ReturnsView.jsx'
import HistoryView from './components/HistoryView.jsx'
import ReportsView from './components/ReportsView.jsx'
import UserManagementView from './components/UserManagementView.jsx'
import CustomerShopView from './components/CustomerShopView.jsx'
import CustomerCartView from './components/CustomerCartView.jsx'
import CustomerOrdersView from './components/CustomerOrdersView.jsx'
import { filterDemoProducts } from './demo/demo-data.js'
import { useDemoState } from './demo/demo-state.js'
import {
  ApiError,
  createProduct,
  updateProduct,
  getCurrentUser,
  getProducts,
  signOut,
} from './services/products-api.js'
import {
  getDatabaseHealth,
  getDashboardKpis,
  getStockLedger,
  getOrdersApi,
  createOrderApi,
  confirmOrderApi,
  cancelOrderApi,
  processReturnApi,
  getAuditLogsApi,
  receiveStockApi,
  getCustomerProductsApi,
  customerCheckoutApi,
  getCustomerOrdersApi,
  cancelCustomerOrderApi,
} from './services/inventory-api.js'
import {
  clearStoredSession,
  readStoredSession,
  storeSession,
} from './services/auth-session.js'
import {
  DEFAULT_PREVIEW_ROLE,
  ROLE_DETAILS,
  ROLE_NAVIGATION,
  UNAVAILABLE_PAGES,
} from './roles.js'
import './App.css'

const EMPTY_FILTERS = { sku: '', name: '', category: '', stockStatus: '' }

function formatNumber(value) {
  return new Intl.NumberFormat('en-IN').format(value)
}

function getErrorMessage(error) {
  if (error instanceof ApiError && error.status === 503) {
    return 'The PostgreSQL database service is unavailable. Check that the backend is running and DATABASE_URL is configured.'
  }
  return error.message || 'The request could not be completed.'
}

function getPageDetails(page, role, isLiveMode) {
  const modeSuffix = isLiveMode ? ' (Live Neon PostgreSQL)' : ' (Demo Mode)'

  if (page === 'dashboard') {
    if (role === 'customer') {
      return {
        eyebrow: 'CUSTOMER WORKSPACE',
        title: 'Customer Catalogue & Availability',
        subtitle: `Browse inventory and check real-time stock availability${modeSuffix}.`,
      }
    }
    return {
      eyebrow: `${ROLE_DETAILS[role]?.label?.toUpperCase() || 'RETAIL'} WORKSPACE`,
      title: `${ROLE_DETAILS[role]?.label || 'Retail'} Dashboard`,
      subtitle: `Inventory metrics, stock movements, and transaction operations${modeSuffix}.`,
    }
  }

  if (page === 'products' || page === 'inventory') {
    return {
      eyebrow: 'CATALOGUE & STOCK REGISTER',
      title: 'Product Inventory',
      subtitle: `Search, filter, view details, and manage inventory items${modeSuffix}.`,
    }
  }

  if (page === 'stock-receiving') {
    return {
      eyebrow: 'STOCK INTAKE WORKFLOW',
      title: 'Stock Receiving',
      subtitle: `Log physical incoming shipments and update the live stock ledger${modeSuffix}.`,
    }
  }

  if (page === 'transactions' || page === 'new-transaction' || page === 'my-transactions') {
    return {
      eyebrow: 'TRANSACTION ENGINE',
      title: 'Order & Reservation Management',
      subtitle: `Create customer orders, reserve stock, and confirm or cancel transactions${modeSuffix}.`,
    }
  }

  if (page === 'returns') {
    return {
      eyebrow: 'REVERSE LOGISTICS',
      title: 'Customer Returns Processing',
      subtitle: `Select confirmed orders, return eligible merchandise, and restore inventory${modeSuffix}.`,
    }
  }

  if (page === 'audit-logs') {
    return {
      eyebrow: 'TRANSACTION AUDIT TRAIL',
      title: 'System Audit Logs & Stock Movements',
      subtitle: `Complete chronological history of stock mutations and security events${modeSuffix}.`,
    }
  }

  if (page === 'reports') {
    return {
      eyebrow: 'MANAGEMENT REPORTING',
      title: 'Analytics & Integration Matrix',
      subtitle: `Valuation, turnover, category distribution, and project integration status${modeSuffix}.`,
    }
  }

  if (page === 'user-management') {
    return {
      eyebrow: 'SECURITY & RBAC',
      title: 'User Management & Role Matrix',
      subtitle: 'Configured system accounts, permission boundaries, and access control.',
    }
  }

  if (page === 'shop') {
    return {
      eyebrow: 'ONLINE STORE',
      title: 'Product Catalogue',
      subtitle: `Browse available items, check prices, and add products to your cart${modeSuffix}.`,
    }
  }

  if (page === 'cart') {
    return {
      eyebrow: 'SHOPPING CART',
      title: 'Review & Checkout',
      subtitle: `Review selected products, quantities, and place your order${modeSuffix}.`,
    }
  }

  if (page === 'my-orders') {
    return {
      eyebrow: 'ORDER HISTORY',
      title: 'My Purchases',
      subtitle: `View current and past orders, statuses, and cancel pending reservations${modeSuffix}.`,
    }
  }

  const unavailable = UNAVAILABLE_PAGES[page]
  return {
    eyebrow: 'INTEGRATION PENDING',
    title: unavailable?.title || 'Page Unavailable',
    subtitle: unavailable?.description || 'This view has not been connected.',
  }
}

function getInitialPage() {
  const hash = window.location.hash.replace(/^#/, '').trim()
  if (hash) return hash
  const stored = sessionStorage.getItem('tbims.active-page')
  if (stored) return stored
  return 'dashboard'
}

function App() {
  // Mode selection: Live Database Mode (default unless explicitly set to demo) vs Demo Mode
  const [isLiveMode, setIsLiveMode] = useState(() => {
    return sessionStorage.getItem('tbims.mode') !== 'demo'
  })

  // Demo state engine (in-memory baseline)
  const demoState = useDemoState()

  // Live database state
  const [dbInfo, setDbInfo] = useState(null)
  const [dbError, setDbError] = useState(null)
  const [liveProducts, setLiveProducts] = useState([])
  const [liveOrders, setLiveOrders] = useState([])
  const [liveMovements, setLiveMovements] = useState([])
  const [liveAuditLog, setLiveAuditLog] = useState([])
  const [liveKpis, setLiveKpis] = useState(null)

  // Authentication & session management
  const [initialSession] = useState(() => readStoredSession())
  const [session, setSession] = useState(() => initialSession)

  const [authChecking, setAuthChecking] = useState(Boolean(initialSession && isLiveMode))
  const [authError, setAuthError] = useState('')
  const role = session?.user?.role || DEFAULT_PREVIEW_ROLE

  // Navigation management
  const [page, setPage] = useState(() => {
    const initial = getInitialPage()
    if (session?.user?.role === 'customer' && initial === 'dashboard') return 'shop'
    return initial
  })
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS })
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState(null)
  const [apiState, setApiState] = useState('checking')
  const [refreshKey, setRefreshKey] = useState(0)

  // Customer shopping cart state
  const [cart, setCart] = useState(() => {
    try {
      const stored = sessionStorage.getItem('tbims.customer-cart')
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    try {
      sessionStorage.setItem('tbims.customer-cart', JSON.stringify(cart))
    } catch {
      // ignore
    }
  }, [cart])

  // Customer auto-routing
  useEffect(() => {
    if (role === 'customer' && (page === 'dashboard' || !ROLE_NAVIGATION.customer?.some((i) => i.id === page))) {
      setPage('shop')
    }
  }, [role, page])

  // Dialog and feedback states
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [isEditingProduct, setIsEditingProduct] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null)

  // Mode toggle handler
  const handleToggleMode = useCallback(() => {
    setIsLiveMode((current) => {
      const next = !current
      sessionStorage.setItem('tbims.mode', next ? 'live' : 'demo')
      setNotice({
        kind: 'info',
        message: next
          ? 'Switched to Live Database Mode (connecting to PostgreSQL/Neon).'
          : 'Switched to Demonstration Mode (isolated in-memory workspace).',
      })
      return next
    })
    setRefreshKey((k) => k + 1)
  }, [])

  // Synchronize hash on page change and listen to browser back/forward
  useEffect(() => {
    window.location.hash = page
    sessionStorage.setItem('tbims.active-page', page)
  }, [page])

  useEffect(() => {
    const handleHashChange = () => {
      const next = window.location.hash.replace(/^#/, '').trim()
      if (next && ROLE_NAVIGATION[role]?.some((item) => item.id === next)) {
        setPage(next)
      }
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [role])

  // Probe database connection and load live data when in Live Mode
  useEffect(() => {
    if (!isLiveMode) {
      setApiState('demo')
      setDbError(null)
      return undefined
    }

    let isMounted = true
    const controller = new AbortController()

    async function loadLiveData() {
      setLoading(true)
      setApiError(null)

      try {
        // 1. Probe database health
        const health = await getDatabaseHealth({ signal: controller.signal })
        if (!isMounted) return

        if (!health?.ok) {
          setDbInfo(null)
          setDbError(health?.error || 'Database connection is unavailable.')
          setApiState('unavailable')
          setLoading(false)
          return
        }

        setDbInfo(health)
        setDbError(null)
        setApiState('connected')

        // 2. Fetch live data
        if (role === 'customer') {
          // Customer role uses safe customer endpoints
          const [custProducts, custOrders] = await Promise.allSettled([
            getCustomerProductsApi({}, { token: session?.token, signal: controller.signal }),
            getCustomerOrdersApi({ token: session?.token, signal: controller.signal }),
          ])

          if (!isMounted) return
          if (custProducts.status === 'fulfilled') setLiveProducts(custProducts.value)
          if (custOrders.status === 'fulfilled') setLiveOrders(custOrders.value)
        } else {
          // Internal roles fetch internal overview & products
          const [kpis, orders, ledger, audit] = await Promise.allSettled([
            getDashboardKpis({ token: session?.token, signal: controller.signal }),
            getOrdersApi({ token: session?.token, signal: controller.signal }),
            getStockLedger({ token: session?.token, signal: controller.signal }),
            getAuditLogsApi({ token: session?.token, signal: controller.signal }),
          ])

          if (!isMounted) return
          if (kpis.status === 'fulfilled') setLiveKpis(kpis.value)
          if (orders.status === 'fulfilled') setLiveOrders(orders.value)
          if (ledger.status === 'fulfilled') setLiveMovements(ledger.value)
          if (audit.status === 'fulfilled') setLiveAuditLog(audit.value)

          // 3. Fetch products
          try {
            const prodResult = await getProducts(filters, {
              signal: controller.signal,
              token: session?.token,
            })
            if (isMounted) setLiveProducts(prodResult.products)
          } catch (prodErr) {
            if (isMounted) setApiError(prodErr)
          }
        }
      } catch (err) {
        if (!isMounted || err.name === 'AbortError') return
        setDbInfo(null)
        setDbError(err.message || 'Could not connect to PostgreSQL backend.')
        setApiState('unavailable')
        setApiError(err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadLiveData()

    return () => {
      isMounted = false
      controller.abort()
    }
  }, [isLiveMode, refreshKey, session?.token, role])

  // Compute active dataset based on mode
  const currentProducts = isLiveMode
    ? liveProducts
    : filterDemoProducts(demoState.products, filters)

  const currentOrders = isLiveMode ? liveOrders : demoState.orders
  const currentMovements = isLiveMode ? liveMovements : demoState.movements
  const currentAuditLog = isLiveMode ? liveAuditLog : demoState.auditLog

  const currentTotals = isLiveMode && liveKpis
    ? {
        products: liveKpis.products,
        onHand: liveKpis.onHand,
        reserved: liveKpis.reserved,
        available: liveKpis.available,
        lowStock: liveKpis.lowStock,
      }
    : demoState.totals

  const categories = isLiveMode
    ? [...new Set(liveProducts.map((p) => p.category).filter(Boolean))].sort()
    : demoState.categories

  const pageDetails = getPageDetails(page, role, isLiveMode)
  const visibleApiState = isLiveMode ? (dbInfo?.ok ? 'connected' : 'unavailable') : 'demo'

  const handleNavigate = useCallback(
    (nextPage) => {
      const allowedNav = ROLE_NAVIGATION[role] || []
      let target = nextPage
      if (nextPage === 'inventory' && !allowedNav.some((i) => i.id === 'inventory') && allowedNav.some((i) => i.id === 'products')) {
        target = 'products'
      }
      if (!allowedNav.some((item) => item.id === target)) {
        target = role === 'customer' ? 'shop' : 'dashboard'
      }
      setPage(target)
      setNotice(null)
      if (target === 'dashboard' || target === 'shop') setFilters({ ...EMPTY_FILTERS })
    },
    [role],
  )

  const handleRoleChange = useCallback((nextRole) => {
    // Strictly disallow creating mock sessions in Live Database Mode
    if (isLiveMode) return
    const newSession = {
      token: `demo-bearer-token-${nextRole}`,
      user: { username: nextRole, role: nextRole },
    }
    storeSession(newSession)
    setSession(newSession)
    setPage(nextRole === 'customer' ? 'shop' : 'dashboard')
    setFilters({ ...EMPTY_FILTERS })
    setNotice(null)
  }, [isLiveMode])

  const handleFilterChange = useCallback((name, value) => {
    setFilters((current) => ({ ...current, [name]: value }))
  }, [])

  const handleSignIn = useCallback((nextSession) => {
    storeSession(nextSession)
    setSession(nextSession)
    setAuthError('')
    setPage(nextSession.user.role === 'customer' ? 'shop' : 'dashboard')
    setFilters({ ...EMPTY_FILTERS })
    setNotice({ kind: 'success', message: 'Signed in with backend credentials.' })
  }, [])

  const handleDemoSignIn = useCallback((demoSession) => {
    storeSession(demoSession)
    setSession(demoSession)
    setAuthError('')
    setPage(demoSession.user.role === 'customer' ? 'shop' : 'dashboard')
    setFilters({ ...EMPTY_FILTERS })
    setNotice({
      kind: 'success',
      message: `Signed in as ${ROLE_DETAILS[demoSession.user.role]?.label || demoSession.user.role} in demonstration mode.`,
    })
  }, [])

  // Cart operations
  const handleAddToCart = useCallback((product, quantity = 1) => {
    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.product.id === product.id)
      if (existingIndex >= 0) {
        const next = [...prev]
        next[existingIndex] = {
          ...next[existingIndex],
          quantity: next[existingIndex].quantity + quantity,
        }
        return next
      }
      return [...prev, { product, quantity }]
    })
    setNotice({
      kind: 'success',
      message: `Added ${quantity}x "${product.name}" to your shopping cart.`,
    })
  }, [])

  const handleUpdateCartQuantity = useCallback((productId, quantity) => {
    setCart((prev) => {
      if (quantity <= 0) {
        return prev.filter((item) => item.product.id !== productId)
      }
      return prev.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    })
  }, [])

  const handleRemoveFromCart = useCallback((productId) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId))
  }, [])

  const handleClearCart = useCallback(() => {
    setCart([])
  }, [])

  // Customer Checkout
  const handleCustomerCheckout = useCallback(
    async (cartItems) => {
      if (isLiveMode) {
        const payload = {
          items: cartItems.map((item) => ({
            productId: item.product.id,
            sku: item.product.sku,
            quantity: item.quantity,
          })),
        }
        const createdOrder = await customerCheckoutApi(payload, { token: session?.token })
        setRefreshKey((k) => k + 1)
        return createdOrder
      }

      // Demo Mode simulation
      const orderData = {
        customerName: session?.user?.username || 'Customer',
        items: cartItems.map((item) => ({
          productId: item.product.id,
          sku: item.product.sku,
          quantity: item.quantity,
        })),
        notes: 'Customer online order',
      }
      const createdOrder = demoState.reserveStockAndCreateOrder(orderData)
      return createdOrder
    },
    [demoState, isLiveMode, session?.token, session?.user?.username]
  )

  // Customer Cancel Order
  const handleCustomerCancelOrder = useCallback(
    async (orderId) => {
      if (isLiveMode) {
        const cancelled = await cancelCustomerOrderApi(orderId, { token: session?.token })
        setRefreshKey((k) => k + 1)
        return cancelled
      }
      const cancelled = demoState.cancelOrder({
        orderId,
        performedBy: session?.user?.username || 'Customer',
      })
      return cancelled
    },
    [demoState, isLiveMode, session?.token, session?.user?.username]
  )

  // Real or Demo: Receive Stock
  const handleReceiveStock = useCallback(
    async (intakeData) => {
      setSaving(true)
      try {
        if (isLiveMode) {
          const updated = await receiveStockApi(intakeData, { token: session?.token })
          setRefreshKey((k) => k + 1)
          return updated
        }
        return demoState.receiveStock(intakeData)
      } finally {
        setSaving(false)
      }
    },
    [demoState, isLiveMode, session?.token],
  )

  // Real or Demo: Reserve Stock & Order
  const handleReserveStock = useCallback(
    async (orderData) => {
      setSaving(true)
      try {
        if (isLiveMode) {
          const created = await createOrderApi(orderData, { token: session?.token })
          setRefreshKey((k) => k + 1)
          return created
        }
        return demoState.reserveStockAndCreateOrder(orderData)
      } finally {
        setSaving(false)
      }
    },
    [demoState, isLiveMode, session?.token],
  )

  // Real or Demo: Confirm Order
  const handleConfirmOrder = useCallback(
    async ({ orderId, performedBy }) => {
      if (isLiveMode) {
        const confirmed = await confirmOrderApi(orderId, { token: session?.token })
        setRefreshKey((k) => k + 1)
        return confirmed
      }
      return demoState.confirmOrder({ orderId, performedBy })
    },
    [demoState, isLiveMode, session?.token],
  )

  // Real or Demo: Cancel Order
  const handleCancelOrder = useCallback(
    async ({ orderId, performedBy }) => {
      if (isLiveMode) {
        const cancelled = await cancelOrderApi(orderId, { token: session?.token })
        setRefreshKey((k) => k + 1)
        return cancelled
      }
      return demoState.cancelOrder({ orderId, performedBy })
    },
    [demoState, isLiveMode, session?.token],
  )

  // Real or Demo: Process Return
  const handleProcessReturn = useCallback(
    async (returnData) => {
      if (isLiveMode) {
        const returned = await processReturnApi(returnData.orderId, returnData, { token: session?.token })
        setRefreshKey((k) => k + 1)
        return returned
      }
      return demoState.processReturn(returnData)
    },
    [demoState, isLiveMode, session?.token],
  )

  // Real or Demo: Create Product
  const handleCreateProduct = useCallback(
    async (productInput) => {
      setSaving(true)
      setNotice(null)

      try {
        if (isLiveMode) {
          const result = await createProduct(productInput, { token: session?.token })
          setShowAddProduct(false)
          setPage('products')
          setFilters({ ...EMPTY_FILTERS })
          setRefreshKey((current) => current + 1)
          setNotice({
            kind: 'success',
            message: `Product ${result.product.sku} created in PostgreSQL database.`,
          })
          return
        }

        const newProduct = demoState.addProduct(productInput)
        setFilters({ ...EMPTY_FILTERS })
        setPage('products')
        setShowAddProduct(false)
        setNotice({
          kind: 'success',
          message: `Product "${newProduct.name}" (${newProduct.sku}) added to in-memory catalogue.`,
        })
      } catch (err) {
        setNotice({ kind: 'error', message: err.message || 'Failed to add product.' })
      } finally {
        setSaving(false)
      }
    },
    [demoState, isLiveMode, session?.token],
  )

  const handleSaveProductEdit = useCallback(
    async (updatedData) => {
      try {
        if (isLiveMode && selectedProduct?.id) {
          await updateProduct(selectedProduct.id, updatedData, { token: session?.token })
          setRefreshKey((k) => k + 1)
        } else {
          demoState.updateProduct(updatedData)
        }
        setSelectedProduct(null)
        setIsEditingProduct(false)
        setNotice({
          kind: 'success',
          message: `Product ${updatedData.sku} details updated.`,
        })
      } catch (err) {
        setNotice({ kind: 'error', message: err.message || 'Failed to update product.' })
      }
    },
    [demoState, isLiveMode, selectedProduct?.id, session?.token],
  )

  const handleResetDemoDataConfirm = useCallback(() => {
    demoState.resetDemoData()
    setShowResetConfirm(false)
    setFilters({ ...EMPTY_FILTERS })
    setNotice({
      kind: 'success',
      message: 'Demo dataset has been reset to its initial baseline state.',
    })
  }, [demoState])

  const handleLogout = useCallback(async () => {
    let logoutError = ''
    try {
      if (session?.token && isLiveMode) await signOut({ token: session.token })
    } catch {
      logoutError = 'Signed out locally; server session cleared.'
    }

    clearStoredSession()
    setSession(null)
    setAuthError(logoutError)
    setPage('dashboard')
    setNotice(null)
  }, [isLiveMode, session])

  if (!session) {
    return (
      <SignInView
        initialError={authError}
        onClearError={() => setAuthError('')}
        onSignIn={handleSignIn}
        onDemoSignIn={handleDemoSignIn}
        isLiveMode={isLiveMode}
        onToggleMode={handleToggleMode}
      />
    )
  }

  const isDashboard = page === 'dashboard'
  const isProducts = page === 'products' || page === 'inventory'
  const isStockReceiving = page === 'stock-receiving'
  const isTransactions = page === 'transactions' || page === 'new-transaction' || page === 'my-transactions'
  const isReturns = page === 'returns'
  const isAuditLogs = page === 'audit-logs'
  const isReports = page === 'reports'
  const isUserManagement = page === 'user-management'
  const isShop = page === 'shop'
  const isCart = page === 'cart'
  const isCustomerOrders = page === 'my-orders'

  const canCreateProduct = ['owner', 'admin', 'inventoryManager'].includes(role)
  const canEditProduct = ['owner', 'admin', 'inventoryManager'].includes(role)
  const roleHasPage = ROLE_NAVIGATION[role]?.some((item) => item.id === page) || page === 'inventory'
  const unavailablePage = UNAVAILABLE_PAGES[page]

  return (
    <div className="app-shell">
      <Sidebar
        activePage={page}
        apiState={visibleApiState}
        isDemoMode={!isLiveMode}
        role={role}
        onNavigate={handleNavigate}
      />

      <div className="workspace">
        <TopBar
          apiState={visibleApiState}
          role={role}
          user={session?.user}
          isLiveMode={isLiveMode}
          dbInfo={dbInfo}
          dbError={dbError}
          onToggleMode={handleToggleMode}
          onRoleChange={handleRoleChange}
          onResetDemoData={() => setShowResetConfirm(true)}
          onLogout={handleLogout}
        />

        <main className="main-content">
          {/* Live Mode Database Connection Error Banner (No silent fallback!) */}
          {isLiveMode && dbError && (
            <div className="notice notice--error" role="alert" style={{ marginBottom: 20 }}>
              <Icon name="alert" size={20} />
              <div style={{ flex: 1 }}>
                <strong>PostgreSQL Database Unavailable: </strong>
                <span>{dbError}</span>
                <div style={{ marginTop: 4, fontSize: '12px' }}>
                  Live Mode cannot load records because the Neon database is not reachable.
                  You can configure <code>backend/.env</code> or click <strong>Mode: Demo</strong> in the top bar for presentation mode.
                </div>
              </div>
              <button
                type="button"
                className="button button--secondary button--compact"
                onClick={handleToggleMode}
              >
                Switch to Demo Mode
              </button>
            </div>
          )}

          {/* Demo Mode Notice Banner */}
          {!isLiveMode && (
            <div className="demo-banner" role="status">
              <Icon name="alert" size={17} />
              <span>DEMONSTRATION MODE — IN-MEMORY SIMULATED DATA</span>
              <span className="demo-banner__detail">
                Mutations stay in this browser session and strictly verify <code>available = on_hand - reserved</code>.
              </span>
            </div>
          )}

          {/* Page Heading */}
          <div className="page-heading">
            <div>
              <p className="eyebrow">{pageDetails.eyebrow}</p>
              <h1>{pageDetails.title}</h1>
              <p className="page-subtitle">{pageDetails.subtitle}</p>
            </div>
            {canCreateProduct && (isDashboard || isProducts) && (
              <button
                className="button button--primary heading-action"
                onClick={() => setShowAddProduct(true)}
                type="button"
              >
                <Icon name="plus" size={17} />
                Add product
              </button>
            )}
          </div>

          {/* Notifications */}
          {notice && (
            <div className={`notice notice--${notice.kind}`} role="status">
              <Icon
                name={notice.kind === 'success' ? 'check' : 'alert'}
                size={18}
              />
              <span>{notice.message}</span>
              <button
                type="button"
                className="icon-button notice__close"
                aria-label="Dismiss message"
                onClick={() => setNotice(null)}
              >
                <Icon name="close" size={16} />
              </button>
            </div>
          )}

          {/* PAGE 1: DASHBOARD */}
          {isDashboard && (
            <DashboardView
              role={role}
              data={{
                products: currentProducts,
                orders: currentOrders,
                movements: currentMovements,
                totals: currentTotals,
                loading,
                error: apiError || (isLiveMode && dbError ? new Error(dbError) : null),
                filters,
                categories,
                onFilterChange: handleFilterChange,
                onNavigate: handleNavigate,
              }}
            />
          )}

          {/* PAGE 2: PRODUCTS / INVENTORY */}
          {isProducts && (
            <section className="inventory-panel">
              <div className="panel-heading">
                <div>
                  <h2>All Products ({currentProducts.length})</h2>
                  <p>
                    {loading
                      ? 'Loading product data…'
                      : apiError || dbError
                        ? 'Product data could not be loaded from database.'
                        : `${formatNumber(currentProducts.length)} products retrieved`}
                  </p>
                </div>
                {isLiveMode && dbInfo?.ok && (
                  <span className="source-label">
                    <Icon name="database" size={15} /> Neon PostgreSQL ({dbInfo.database})
                  </span>
                )}
                {!isLiveMode && (
                  <span className="source-label">
                    <Icon name="box" size={15} /> Demo In-Memory State
                  </span>
                )}
              </div>
              <ProductFilters
                filters={filters}
                categories={categories}
                onChange={handleFilterChange}
              />
              <ProductsTable
                products={currentProducts}
                loading={loading}
                error={apiError || (isLiveMode && dbError ? new Error(dbError) : null)}
                canEdit={canEditProduct}
                onViewProduct={(prod) => {
                  setSelectedProduct(prod)
                  setIsEditingProduct(false)
                }}
                onEditProduct={(prod) => {
                  setSelectedProduct(prod)
                  setIsEditingProduct(true)
                }}
                onAddProduct={
                  canCreateProduct ? () => setShowAddProduct(true) : undefined
                }
              />
            </section>
          )}

          {/* PAGE 3: STOCK RECEIVING */}
          {isStockReceiving && (
            <StockReceivingView
              products={currentProducts}
              onReceiveStock={handleReceiveStock}
              movements={currentMovements}
              isLiveMode={isLiveMode}
            />
          )}

          {/* PAGE 4: TRANSACTIONS / ORDERS */}
          {isTransactions && (
            <TransactionsView
              orders={currentOrders}
              products={currentProducts}
              onReserveStock={handleReserveStock}
              onConfirmOrder={handleConfirmOrder}
              onCancelOrder={handleCancelOrder}
              role={role}
              isLiveMode={isLiveMode}
            />
          )}

          {/* PAGE 5: RETURNS */}
          {isReturns && (
            <ReturnsView
              orders={currentOrders}
              products={currentProducts}
              onProcessReturn={handleProcessReturn}
              movements={currentMovements}
              isLiveMode={isLiveMode}
            />
          )}

          {/* PAGE 6: AUDIT LOGS & MOVEMENTS */}
          {isAuditLogs && (
            <HistoryView
              movements={currentMovements}
              auditLog={currentAuditLog}
              isLiveMode={isLiveMode}
            />
          )}

          {/* PAGE 7: REPORTS */}
          {isReports && (
            <ReportsView
              products={currentProducts}
              orders={currentOrders}
              isLiveMode={isLiveMode}
            />
          )}

          {/* PAGE 8: USER MANAGEMENT */}
          {isUserManagement && (
            <UserManagementView currentRole={role} />
          )}

          {/* PAGE 9: CUSTOMER SHOP CATALOGUE */}
          {isShop && (
            <CustomerShopView
              products={isLiveMode ? liveProducts : demoState.products.map(p => ({
                id: p.id,
                sku: p.sku,
                name: p.name,
                unit_price: p.unit_price,
                available: p.available,
                in_stock: p.available > 0,
              }))}
              loading={loading}
              error={apiError || (isLiveMode && dbError ? new Error(dbError) : null)}
              cart={cart}
              onAddToCart={handleAddToCart}
              onNavigate={handleNavigate}
            />
          )}

          {/* PAGE 10: CUSTOMER SHOPPING CART */}
          {isCart && (
            <CustomerCartView
              cart={cart}
              onUpdateQuantity={handleUpdateCartQuantity}
              onRemoveItem={handleRemoveFromCart}
              onClearCart={handleClearCart}
              onCheckout={handleCustomerCheckout}
              onNavigate={handleNavigate}
            />
          )}

          {/* PAGE 11: CUSTOMER ORDER HISTORY */}
          {isCustomerOrders && (
            <CustomerOrdersView
              orders={isLiveMode ? liveOrders : demoState.orders.filter(o =>
                !o.customer || o.customer === session?.user?.username || o.customer === 'Customer'
              )}
              loading={loading}
              error={apiError || (isLiveMode && dbError ? new Error(dbError) : null)}
              onCancelOrder={handleCustomerCancelOrder}
              onNavigate={handleNavigate}
            />
          )}

          {/* FALLBACK FOR UNRECOGNIZED ROUTE */}
          {!isDashboard && !isProducts && !isStockReceiving && !isTransactions && !isReturns && !isAuditLogs && !isReports && !isUserManagement && !isShop && !isCart && !isCustomerOrders && roleHasPage && unavailablePage && (
            <UnavailablePage
              {...unavailablePage}
              onBack={() => handleNavigate('dashboard')}
            />
          )}

          <footer className="page-footer">
            <span>TBIMS · Transaction-Based Retail Inventory Management System</span>
            <span>
              {isLiveMode
                ? (dbInfo?.ok ? `Live PostgreSQL Database (${dbInfo.database})` : 'PostgreSQL Connection Required')
                : 'Demonstration Workspace · In-Memory Simulation'}
            </span>
          </footer>
        </main>
      </div>

      {/* Add Product Modal */}
      {showAddProduct && canCreateProduct && (
        <AddProductDialog
          saving={saving}
          error={notice?.kind === 'error' ? notice.message : null}
          supportsCategory={!isLiveMode}
          onClose={() => {
            setShowAddProduct(false)
            if (notice?.kind === 'error') setNotice(null)
          }}
          onSubmit={handleCreateProduct}
        />
      )}

      {/* Product Detail / Edit Dialog */}
      {selectedProduct && (
        <ProductDetailDialog
          product={selectedProduct}
          canEdit={canEditProduct}
          isEditingInitially={isEditingProduct}
          onClose={() => {
            setSelectedProduct(null)
            setIsEditingProduct(false)
          }}
          onSave={handleSaveProductEdit}
        />
      )}

      {/* Reset Demo Data Confirmation Modal */}
      {showResetConfirm && (
        <div className="modal-backdrop" onClick={() => setShowResetConfirm(false)}>
          <div className="modal-dialog modal-dialog--sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Reset Demo Data</h2>
              <button
                type="button"
                className="icon-button"
                onClick={() => setShowResetConfirm(false)}
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to reset all products, stock levels, orders, and ledger history back to their initial state?
              </p>
              <p className="form-note">
                Any products added, stock received, or orders placed during this session will be reverted.
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="button button--secondary"
                onClick={() => setShowResetConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button button--danger"
                onClick={handleResetDemoDataConfirm}
              >
                Reset All Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
