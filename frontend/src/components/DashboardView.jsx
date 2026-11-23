import Icon from './Icon.jsx'
import MetricCard from './MetricCard.jsx'
import ProductFilters from './ProductFilters.jsx'
import ProductsTable from './ProductsTable.jsx'
import { LOW_STOCK_THRESHOLD } from '../demo/demo-data.js'

function formatNumber(value) {
  return value === null || value === undefined
    ? '—'
    : new Intl.NumberFormat('en-IN').format(value)
}

function formatCurrency(value) {
  const price = Number(value)
  if (!Number.isFinite(price) || price < 0) return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(price)
}

function MetricGrid({ metrics }) {
  return (
    <section className="metrics-grid" aria-label="Inventory summary">
      {metrics.map((metric) => (
        <MetricCard
          key={metric.label}
          label={metric.label}
          value={metric.value === null ? '—' : formatNumber(metric.value)}
          detail={metric.detail}
          icon={metric.icon}
          tone={metric.tone}
        />
      ))}
    </section>
  )
}

function LowStockSection({ products, onNavigate }) {
  const lowStockItems = products.filter(
    (p) => Number(p.on_hand) <= LOW_STOCK_THRESHOLD
  )

  return (
    <section className="dashboard-section">
      <div className="section-heading">
        <div>
          <h2>Low-Stock Warnings ({lowStockItems.length})</h2>
          <p>
            Products where physical on-hand stock is at or below the threshold of {LOW_STOCK_THRESHOLD} units.
          </p>
        </div>
        {lowStockItems.length > 0 && (
          <button
            type="button"
            className="button button--secondary button--compact"
            onClick={() => onNavigate('stock-receiving')}
          >
            <Icon name="packagePlus" size={15} /> Receive Stock
          </button>
        )}
      </div>

      {lowStockItems.length === 0 ? (
        <div className="empty-state-notice">
          <Icon name="check" size={20} />
          <span>All catalogue items currently satisfy safe inventory thresholds.</span>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="products-table compact-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Category</th>
                <th className="numeric">On Hand</th>
                <th className="numeric">Reserved</th>
                <th className="numeric">Available</th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {lowStockItems.map((p) => {
                const isOutOfStock = Number(p.available) <= 0
                return (
                  <tr key={p.sku} className="low-stock-row">
                    <td>
                      <div className="product-name">
                        <span className="product-avatar">{p.name[0]?.toUpperCase()}</span>
                        <div>
                          <strong>{p.name}</strong>
                          <div>
                            <span className="low-stock-badge">
                              {isOutOfStock ? 'Out of stock' : 'Low stock'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td><span className="sku-label">{p.sku}</span></td>
                    <td><span className="category-label">{p.category || 'General'}</span></td>
                    <td className="numeric">
                      <strong className="qty-negative">{p.on_hand}</strong>
                    </td>
                    <td className="numeric">{p.reserved}</td>
                    <td className="numeric">
                      <strong className={isOutOfStock ? 'qty-negative' : 'available-value'}>
                        {p.available}
                      </strong>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="button button--primary button--compact"
                        onClick={() => onNavigate('stock-receiving')}
                      >
                        Restock
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function RecentOrdersSection({ orders = [], onNavigate }) {
  const recentOrders = orders.slice(0, 5)

  return (
    <section className="dashboard-section">
      <div className="section-heading">
        <div>
          <h2>Recent Orders &amp; Reservations</h2>
          <p>Latest active customer transactions from the demonstration state.</p>
        </div>
        <button
          type="button"
          className="button button--secondary button--compact"
          onClick={() => onNavigate('transactions')}
        >
          View All ({orders.length})
        </button>
      </div>

      {recentOrders.length === 0 ? (
        <div className="empty-state-notice">
          <Icon name="receipt" size={20} />
          <span>No customer orders have been placed yet.</span>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="products-table compact-table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Customer</th>
                <th>Items</th>
                <th className="numeric">Amount</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => onNavigate('transactions')}
                    >
                      <strong>{o.orderNumber}</strong>
                    </button>
                  </td>
                  <td>{o.customerName}</td>
                  <td>
                    <small className="muted-text">
                      {o.items.map((i) => `${i.quantity}x ${i.productSku}`).join(', ')}
                    </small>
                  </td>
                  <td className="numeric">
                    <strong>{formatCurrency(o.totalAmount)}</strong>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`status-badge status-badge--${o.status.toLowerCase()}`}>
                      {o.status}
                    </span>
                  </td>
                  <td>
                    <span className="timestamp-text">
                      {new Date(o.createdAt).toLocaleDateString()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function RecentMovementsSection({ movements = [], onNavigate }) {
  const recentMovements = movements.slice(0, 5)

  return (
    <section className="dashboard-section">
      <div className="section-heading">
        <div>
          <h2>Recent Stock Movements</h2>
          <p>Chronological stock mutations (intake, sales, returns, adjustments).</p>
        </div>
        <button
          type="button"
          className="button button--secondary button--compact"
          onClick={() => onNavigate('audit-logs')}
        >
          View Full Ledger
        </button>
      </div>

      {recentMovements.length === 0 ? (
        <div className="empty-state-notice">
          <Icon name="history" size={20} />
          <span>No stock movements recorded yet.</span>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="products-table compact-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Type</th>
                <th>Product</th>
                <th className="numeric">Qty Change</th>
                <th className="numeric">Avail After</th>
                <th>Performed By</th>
              </tr>
            </thead>
            <tbody>
              {recentMovements.map((m) => {
                const isPositive = m.quantityChange > 0
                const isNegative = m.quantityChange < 0
                return (
                  <tr key={m.id}>
                    <td>
                      <span className="timestamp-text">
                        {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td>
                      <span className={`movement-pill movement-pill--${m.type.toLowerCase()}`}>
                        {m.type}
                      </span>
                    </td>
                    <td>
                      <strong>{m.productName}</strong> <small className="sku-label">{m.productSku}</small>
                    </td>
                    <td className="numeric">
                      <span className={isPositive ? 'qty-positive' : isNegative ? 'qty-negative' : 'qty-neutral'}>
                        {isPositive ? `+${m.quantityChange}` : m.quantityChange}
                      </span>
                    </td>
                    <td className="numeric">
                      <strong className="available-value">{m.availableAfter}</strong>
                    </td>
                    <td>
                      <span className="user-badge">{m.performedBy}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function QuickActionsBar({ onNavigate, canReceiveStock = true, canCreateOrder = true }) {
  return (
    <section className="quick-actions" aria-label="Inventory quick actions">
      <div>
        <p className="eyebrow">QUICK ACTIONS</p>
        <h2>Demonstration Workflows</h2>
        <p>Trigger atomic inventory operations directly from this control panel.</p>
      </div>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {canReceiveStock && (
          <button
            className="button button--primary"
            onClick={() => onNavigate('stock-receiving')}
            type="button"
          >
            <Icon name="packagePlus" size={17} /> Receive Stock
          </button>
        )}
        {canCreateOrder && (
          <button
            className="button button--secondary"
            onClick={() => onNavigate('transactions')}
            type="button"
          >
            <Icon name="receipt" size={17} /> Place Order / Reserve
          </button>
        )}
        <button
          className="button button--secondary"
          onClick={() => onNavigate('products')}
          type="button"
        >
          <Icon name="box" size={17} /> Catalogue
        </button>
      </div>
    </section>
  )
}

function InvariantBanner({ totals }) {
  const onHand = totals.onHand ?? 0
  const reserved = totals.reserved ?? 0
  const available = totals.available ?? 0
  const isSatisfied = available === onHand - reserved

  return (
    <div className={`inventory-formula-banner ${isSatisfied ? 'formula-verified' : 'formula-error'}`}>
      <span className="formula-icon"><Icon name={isSatisfied ? 'check' : 'alert'} size={18} /></span>
      <div>
        <strong>Stock Invariant Verification: </strong>
        <code>available ({available}) = on_hand ({onHand}) - reserved ({reserved})</code>
        <span className="formula-tag">{isSatisfied ? 'STRICTLY SATISFIED' : 'VIOLATED'}</span>
      </div>
    </div>
  )
}

function CustomerDashboardView({ data }) {
  const { products, filters, categories, onFilterChange } = data

  return (
    <div className="customer-dashboard">
      <div className="customer-welcome-hero">
        <div>
          <h2>Retail Product Catalogue</h2>
          <p>Browse current inventory, search items, and check real-time stock availability.</p>
        </div>
        <span className="badge badge--green">Customer View</span>
      </div>

      <div style={{ marginTop: '16px' }}>
        <ProductFilters
          filters={filters}
          categories={categories}
          onChange={onFilterChange}
        />
        <ProductsTable
          products={products}
          loading={false}
          error={null}
          canEdit={false}
          emptyTitle="No products match your search"
          emptyMessage="Try clearing your search or category filter to view the full product range."
        />
      </div>
    </div>
  )
}

function DashboardView({ role, data }) {
  if (role === 'customer') {
    return <CustomerDashboardView data={data} />
  }

  const {
    products = [],
    orders = [],
    movements = [],
    totals = {},
    onNavigate,
  } = data

  const canReceive = ['owner', 'admin', 'inventoryManager'].includes(role)
  const canOrder = ['owner', 'admin', 'inventoryManager', 'staff'].includes(role)

  return (
    <div className="dashboard-content-layout">
      {/* Stock Invariant Formula Check */}
      <InvariantBanner totals={totals} />

      {/* KPI Metric Cards */}
      <MetricGrid
        metrics={[
          {
            label: 'Total Products',
            value: totals.products,
            detail: 'Active SKUs in catalogue',
            icon: 'box',
            tone: 'blue',
          },
          {
            label: 'Stock on Hand',
            value: totals.onHand,
            detail: 'Total physical units counted',
            icon: 'layers',
            tone: 'violet',
          },
          {
            label: 'Reserved Stock',
            value: totals.reserved,
            detail: 'Units held for pending orders',
            icon: 'clock',
            tone: 'amber',
          },
          {
            label: 'Available Stock',
            value: totals.available,
            detail: 'Ready for sale (On Hand - Reserved)',
            icon: 'check',
            tone: 'green',
          },
        ]}
      />

      {/* Quick Action Navigation */}
      <QuickActionsBar
        onNavigate={onNavigate}
        canReceiveStock={canReceive}
        canCreateOrder={canOrder}
      />

      {/* Low-Stock Section */}
      <LowStockSection products={products} onNavigate={onNavigate} />

      {/* Two Column Grid: Recent Orders & Recent Movements */}
      <div className="two-column-layout" style={{ marginTop: '20px' }}>
        <RecentOrdersSection orders={orders} onNavigate={onNavigate} />
        <RecentMovementsSection movements={movements} onNavigate={onNavigate} />
      </div>
    </div>
  )
}

export default DashboardView
