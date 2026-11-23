import { useState, useEffect } from 'react'
import Icon from './Icon.jsx'

const PAGE_SIZE = 50

function HistoryView({ movements = [], auditLog = [], isLiveMode = false }) {
  const [activeTab, setActiveTab] = useState('movements') // 'movements' | 'audit'
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [movementsPage, setMovementsPage] = useState(1)
  const [auditPage, setAuditPage] = useState(1)

  const filteredMovements = movements.filter((m) => {
    if (typeFilter === 'ALL') return true
    return m.type === typeFilter
  })

  useEffect(() => {
    setMovementsPage(1)
  }, [typeFilter, movements.length])

  useEffect(() => {
    setAuditPage(1)
  }, [auditLog.length])

  // Pagination for movements
  const totalMovements = filteredMovements.length
  const totalMovementPages = Math.max(1, Math.ceil(totalMovements / PAGE_SIZE))
  const safeMovementPage = Math.min(Math.max(1, movementsPage), totalMovementPages)
  const movementStartIndex = (safeMovementPage - 1) * PAGE_SIZE
  const movementEndIndex = Math.min(movementStartIndex + PAGE_SIZE, totalMovements)
  const paginatedMovements = filteredMovements.slice(movementStartIndex, movementEndIndex)

  // Pagination for audit
  const totalAudit = auditLog.length
  const totalAuditPages = Math.max(1, Math.ceil(totalAudit / PAGE_SIZE))
  const safeAuditPage = Math.min(Math.max(1, auditPage), totalAuditPages)
  const auditStartIndex = (safeAuditPage - 1) * PAGE_SIZE
  const auditEndIndex = Math.min(auditStartIndex + PAGE_SIZE, totalAudit)
  const paginatedAudit = auditLog.slice(auditStartIndex, auditEndIndex)

  return (
    <div className="history-view">
      <div className={`demo-banner ${isLiveMode ? 'demo-banner--live' : 'demo-banner--isolated'}`} role="status">
        <Icon name={isLiveMode ? 'database' : 'history'} size={18} />
        <div>
          <strong>
            {isLiveMode ? 'LIVE POSTGRESQL STOCK LEDGER & AUDIT TRAIL' : 'DEMO AUDIT & STOCK MOVEMENT LOGS — P4 INTEGRATION PREVIEW'}
          </strong>
          <span className="demo-banner__detail">
            {isLiveMode
              ? 'Displaying immutable records directly from PostgreSQL stock_ledger and audit_logs tables. Zero simulated data.'
              : 'Reflects chronological in-memory transactions (intake, reservations, order confirmations, cancellations, returns). Sample in-memory mode.'}
          </span>
        </div>
      </div>

      <div className="view-header-bar">
        <div className="tab-buttons">
          <button
            type="button"
            className={`tab-button ${activeTab === 'movements' ? 'tab-button--active' : ''}`}
            onClick={() => setActiveTab('movements')}
          >
            <Icon name="layers" size={16} />
            Stock Movements ({movements.length})
          </button>
          <button
            type="button"
            className={`tab-button ${activeTab === 'audit' ? 'tab-button--active' : ''}`}
            onClick={() => setActiveTab('audit')}
          >
            <Icon name="history" size={16} />
            System Audit Trail ({auditLog.length})
          </button>
        </div>

        {activeTab === 'movements' && (
          <div className="filter-group">
            <span className="filter-label">Movement Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="select-input select-input--compact"
            >
              <option value="ALL">All Types ({movements.length})</option>
              <option value="IN">Intake (IN)</option>
              <option value="RESERVE">Reservation (RESERVE)</option>
              <option value="OUT">Order Fulfilled (OUT)</option>
              <option value="CANCEL_RESERVATION">Reservation Cancelled</option>
              <option value="RETURN">Return</option>
              <option value="PURCHASE">Purchase / Intake (Demo)</option>
              <option value="SALE">Sale / Order (Demo)</option>
              <option value="ADJUSTMENT">Adjustment</option>
              <option value="OPENING">Opening</option>
            </select>
          </div>
        )}
      </div>

      {activeTab === 'movements' && (
        <section className="dashboard-card">
          <div className="card-header">
            <div>
              <h2>Inventory Stock Movement Register</h2>
              <p>Granular ledger of every stock intake, reservation, fulfillment, cancellation, and return.</p>
            </div>
            <span className="badge badge--neutral">{filteredMovements.length} entries</span>
          </div>

          <div className="table-scroll">
            <table className="products-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Type</th>
                  <th>Product</th>
                  <th>SKU</th>
                  <th className="numeric">Qty Change</th>
                  <th className="numeric">Avail After</th>
                  <th>Actor</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '36px', color: '#888' }}>
                      No movements found matching the selected filter.
                    </td>
                  </tr>
                ) : (
                  paginatedMovements.map((m) => {
                    const isPositive = m.quantityChange > 0
                    const isNegative = m.quantityChange < 0
                    return (
                      <tr key={m.id}>
                        <td>
                          <span className="timestamp-text">
                            {new Date(m.createdAt).toLocaleDateString()} {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </td>
                        <td>
                          <span className={`movement-pill movement-pill--${m.type.toLowerCase()}`}>
                            {m.type}
                          </span>
                        </td>
                        <td><strong>{m.productName}</strong></td>
                        <td><span className="sku-label">{m.productSku}</span></td>
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
                        <td>
                          <small className="muted-text">{m.description}</small>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {totalMovementPages > 1 && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px',
              borderTop: '1px solid var(--border-color, #e2e8f0)',
              background: 'var(--surface-color, #ffffff)',
              marginTop: '8px',
              borderRadius: '0 0 8px 8px',
              fontSize: '13px',
              color: 'var(--text-muted, #64748b)'
            }}>
              <div>
                Showing <strong>{movementStartIndex + 1}</strong>–<strong>{movementEndIndex}</strong> of <strong>{totalMovements.toLocaleString()}</strong> movements
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  className="button button--secondary button--compact"
                  disabled={safeMovementPage <= 1}
                  onClick={() => setMovementsPage((p) => Math.max(1, p - 1))}
                  style={{ opacity: safeMovementPage <= 1 ? 0.5 : 1 }}
                >
                  Previous
                </button>
                <span>
                  Page <strong>{safeMovementPage}</strong> of <strong>{totalMovementPages}</strong>
                </span>
                <button
                  type="button"
                  className="button button--secondary button--compact"
                  disabled={safeMovementPage >= totalMovementPages}
                  onClick={() => setMovementsPage((p) => Math.min(totalMovementPages, p + 1))}
                  style={{ opacity: safeMovementPage >= totalMovementPages ? 0.5 : 1 }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {activeTab === 'audit' && (
        <section className="dashboard-card">
          <div className="card-header">
            <div>
              <h2>System Security &amp; Transaction Audit Trail</h2>
              <p>Comprehensive trace of operations, catalogue modifications, and state mutations.</p>
            </div>
            <span className="badge badge--neutral">{auditLog.length} events</span>
          </div>

          <div className="table-scroll">
            <table className="products-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLog.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '36px', color: '#888' }}>
                      No audit events recorded.
                    </td>
                  </tr>
                ) : (
                  paginatedAudit.map((log) => (
                    <tr key={log.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <span className="timestamp-text">
                          {new Date(log.createdAt).toLocaleDateString()} {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </td>
                      <td>
                        <span className="audit-action-pill">
                          {log.action}
                        </span>
                      </td>
                      <td>
                        <span className="user-badge">{log.performedBy}</span>
                      </td>
                      <td>
                        <span className="audit-details-text">{log.details}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalAuditPages > 1 && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px',
              borderTop: '1px solid var(--border-color, #e2e8f0)',
              background: 'var(--surface-color, #ffffff)',
              marginTop: '8px',
              borderRadius: '0 0 8px 8px',
              fontSize: '13px',
              color: 'var(--text-muted, #64748b)'
            }}>
              <div>
                Showing <strong>{auditStartIndex + 1}</strong>–<strong>{auditEndIndex}</strong> of <strong>{totalAudit.toLocaleString()}</strong> events
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  className="button button--secondary button--compact"
                  disabled={safeAuditPage <= 1}
                  onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                  style={{ opacity: safeAuditPage <= 1 ? 0.5 : 1 }}
                >
                  Previous
                </button>
                <span>
                  Page <strong>{safeAuditPage}</strong> of <strong>{totalAuditPages}</strong>
                </span>
                <button
                  type="button"
                  className="button button--secondary button--compact"
                  disabled={safeAuditPage >= totalAuditPages}
                  onClick={() => setAuditPage((p) => Math.min(totalAuditPages, p + 1))}
                  style={{ opacity: safeAuditPage >= totalAuditPages ? 0.5 : 1 }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

export default HistoryView
