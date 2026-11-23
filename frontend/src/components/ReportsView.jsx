import Icon from './Icon.jsx'
import { LOW_STOCK_THRESHOLD } from '../demo/demo-data.js'

function formatCurrency(value) {
  const price = Number(value)
  if (!Number.isFinite(price) || price < 0) return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(price)
}

function ReportsView({ products = [], orders = [], isLiveMode = false }) {
  // Real calculations from demo dataset
  const totalValuation = products.reduce(
    (sum, p) => sum + (Number(p.on_hand) || 0) * (Number(p.unit_price) || 0),
    0
  )

  const lowStockCount = products.filter((p) => Number(p.on_hand) <= LOW_STOCK_THRESHOLD).length
  const outOfStockCount = products.filter((p) => Number(p.available) <= 0).length
  const healthyStockCount = products.length - lowStockCount

  // Category breakdown
  const categoryStats = products.reduce((acc, p) => {
    const cat = p.category || 'Uncategorized'
    if (!acc[cat]) {
      acc[cat] = { count: 0, onHand: 0, value: 0 }
    }
    acc[cat].count += 1
    acc[cat].onHand += Number(p.on_hand) || 0
    acc[cat].value += (Number(p.on_hand) || 0) * (Number(p.unit_price) || 0)
    return acc
  }, {})

  // Order stats
  const totalOrders = orders.length
  const confirmedOrders = orders.filter((o) => o.status === 'CONFIRMED' || o.status === 'COMPLETED').length
  const pendingOrders = orders.filter((o) => o.status === 'PENDING').length
  const cancelledOrders = orders.filter((o) => o.status === 'CANCELLED').length
  const confirmedOrderValue = orders
    .filter((o) => o.status === 'CONFIRMED' || o.status === 'COMPLETED')
    .reduce((sum, o) => sum + Number(o.totalAmount || 0), 0)

  return (
    <div className="reports-view">
      <div className={`demo-banner ${isLiveMode ? 'demo-banner--live' : 'demo-banner--isolated'}`} role="status">
        <Icon name="chart" size={18} />
        <div>
          <strong>TBIMS ANALYTICS &amp; PERFORMANCE REPORT — {isLiveMode ? 'LIVE NEON POSTGRESQL' : 'DEMO DATASET'}</strong>
          <span className="demo-banner__detail">
            All KPIs are calculated dynamically from actual {isLiveMode ? 'database records' : 'in-memory inventory state'}.
            No fabricated data.
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <section className="metrics-grid">
        <article className="metric-card">
          <div className="metric-card__icon metric-card__icon--blue">
            <Icon name="chart" size={18} />
          </div>
          <span className="metric-card__label">Total Catalogue Valuation</span>
          <div className="metric-card__value-row">
            <strong>{formatCurrency(totalValuation)}</strong>
          </div>
          <span className="metric-card__detail">Based on physical on-hand stock</span>
        </article>

        <article className="metric-card">
          <div className="metric-card__icon metric-card__icon--green">
            <Icon name="check" size={18} />
          </div>
          <span className="metric-card__label">Confirmed Turnover</span>
          <div className="metric-card__value-row">
            <strong>{formatCurrency(confirmedOrderValue)}</strong>
          </div>
          <span className="metric-card__detail">{confirmedOrders} confirmed orders fulfilled</span>
        </article>

        <article className="metric-card">
          <div className="metric-card__icon metric-card__icon--amber">
            <Icon name="clock" size={18} />
          </div>
          <span className="metric-card__label">Pending Reservations</span>
          <div className="metric-card__value-row">
            <strong>{pendingOrders}</strong>
          </div>
          <span className="metric-card__detail">Orders holding reserved stock</span>
        </article>

        <article className="metric-card">
          <div className="metric-card__icon metric-card__icon--violet">
            <Icon name="alert" size={18} />
          </div>
          <span className="metric-card__label">Stock Health Warnings</span>
          <div className="metric-card__value-row">
            <strong className={lowStockCount > 0 ? 'qty-negative' : ''}>{lowStockCount}</strong>
          </div>
          <span className="metric-card__detail">Items at or below reorder threshold ({LOW_STOCK_THRESHOLD})</span>
        </article>
      </section>

      {/* Category Distribution Table */}
      <section className="dashboard-card" style={{ marginTop: '20px' }}>
        <div className="card-header">
          <div>
            <h2>Inventory Distribution by Category</h2>
            <p>Breakdown of stock volume and valuation across retail segments.</p>
          </div>
          <span className="badge badge--neutral">{Object.keys(categoryStats).length} categories</span>
        </div>

        <div className="table-scroll">
          <table className="products-table">
            <thead>
              <tr>
                <th>Category</th>
                <th className="numeric">Products</th>
                <th className="numeric">Total On Hand</th>
                <th className="numeric">Stock Valuation</th>
                <th className="numeric">Valuation Share</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(categoryStats).map(([catName, stats]) => {
                const share = totalValuation > 0 ? ((stats.value / totalValuation) * 100).toFixed(1) : '0'
                return (
                  <tr key={catName}>
                    <td>
                      <span className="category-label">{catName}</span>
                    </td>
                    <td className="numeric">{stats.count}</td>
                    <td className="numeric">{stats.onHand}</td>
                    <td className="numeric">
                      <strong>{formatCurrency(stats.value)}</strong>
                    </td>
                    <td className="numeric">
                      <span className="share-pill">{share}%</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Cross-Team Architecture & Integration Status */}
      <section className="dashboard-card" style={{ marginTop: '20px' }}>
        <div className="card-header">
          <div>
            <h2>Project Architecture &amp; Integration Matrix</h2>
            <p>Current status across all four semester project components.</p>
          </div>
          <span className="badge badge--blue">Architecture Status</span>
        </div>

        <div className="table-scroll">
          <table className="products-table compact-table">
            <thead>
              <tr>
                <th>Module / Engine</th>
                <th>Owner</th>
                <th>Status</th>
                <th>Integration Contract Details</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>DBMS &amp; Storage Engine</strong></td>
                <td>P1</td>
                <td><span className="status-badge status-badge--pending">Schema Pending</span></td>
                <td>Provisional product table created; transactional stock mutation functions awaiting P1 signature agreement.</td>
              </tr>
              <tr>
                <td><strong>DSA &amp; Product Search</strong></td>
                <td>P2</td>
                <td><span className="status-badge status-badge--confirmed">Local Adapter Ready</span></td>
                <td>In-memory prefix and substring search adapter connected to P4 product listing API.</td>
              </tr>
              <tr>
                <td><strong>OS &amp; Concurrency Engine</strong></td>
                <td>P3</td>
                <td><span className="status-badge status-badge--pending">Pending Measured Runs</span></td>
                <td>Thread pool, reader-writer locking, and multi-client latency tests to be integrated upon engine delivery.</td>
              </tr>
              <tr>
                <td><strong>Web Technology &amp; SE</strong></td>
                <td>P4 (This Work)</td>
                <td><span className="status-badge status-badge--confirmed">Operational</span></td>
                <td>Express REST API, role-based JWT auth, React 19 UI, complete demo workflows (intake, reserve, confirm, cancel, return).</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export default ReportsView
