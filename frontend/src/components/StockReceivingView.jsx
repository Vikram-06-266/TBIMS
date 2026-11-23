import { useState } from 'react'
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

function StockReceivingView({ products, onReceiveStock, movements = [] }) {
  const [selectedSku, setSelectedSku] = useState(products[0]?.sku || '')
  const [quantity, setQuantity] = useState('10')
  const [reference, setReference] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const selectedProduct = products.find((p) => p.sku === selectedSku) || products[0]

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)

    const parsedQty = parseInt(quantity, 10)
    if (!Number.isInteger(parsedQty) || parsedQty <= 0) {
      setFeedback({
        type: 'error',
        message: 'Received quantity must be a positive integer greater than zero.',
      })
      return
    }

    if (!selectedSku) {
      setFeedback({
        type: 'error',
        message: 'Please select a product to receive stock.',
      })
      return
    }

    setSubmitting(true)
    try {
      const updated = await onReceiveStock({
        productSku: selectedSku,
        quantity: parsedQty,
        reference: reference.trim(),
        referenceId: reference.trim(),
        performedBy: 'manager',
      })

      setFeedback({
        type: 'success',
        message: `Successfully received ${parsedQty} unit(s) of "${updated?.name || selectedSku}" (${updated?.sku || selectedSku}). New on-hand: ${updated?.on_hand ?? 'updated'}, available: ${updated?.available ?? 'updated'}.`,
      })
      setReference('')
      setQuantity('10')
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to receive stock.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  // Filter recent purchase/stock receipts
  const recentReceipts = movements
    .filter((m) => m.type === 'PURCHASE' || m.type === 'OPENING')
    .slice(0, 10)

  return (
    <div className="stock-receiving-view">
      <div className="demo-banner demo-banner--isolated" role="status">
        <Icon name="packagePlus" size={18} />
        <div>
          <strong>DEMO STOCK RECEIVING — P4 WORKFLOW ONLY</strong>
          <span className="demo-banner__detail">
            Demonstrates atomic inventory intake formula: <code>on_hand += qty</code> and <code>available = on_hand - reserved</code>.
            Data stays in this browser session and is not sent to PostgreSQL.
          </span>
        </div>
      </div>

      <div className="two-column-layout">
        {/* Receiving Intake Form */}
        <section className="dashboard-card form-card">
          <div className="card-header">
            <div>
              <h2>Receive Stock Intake</h2>
              <p>Log incoming physical shipments and increase available inventory.</p>
            </div>
            <span className="badge badge--blue">Inbound</span>
          </div>

          {feedback && (
            <div className={`notice notice--${feedback.type === 'success' ? 'success' : 'error'}`} role="status">
              <Icon name={feedback.type === 'success' ? 'check' : 'alert'} size={18} />
              <span>{feedback.message}</span>
              <button
                type="button"
                className="icon-button notice__close"
                onClick={() => setFeedback(null)}
              >
                <Icon name="close" size={15} />
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="stock-form">
            <label className="form-field">
              <span>Select Product to Restock <span className="required">*</span></span>
              <select
                value={selectedSku}
                onChange={(e) => {
                  setSelectedSku(e.target.value)
                  setFeedback(null)
                }}
                disabled={submitting}
                className="select-input"
              >
                {products.map((p) => {
                  const isLow = Number(p.on_hand) <= LOW_STOCK_THRESHOLD
                  return (
                    <option key={p.sku} value={p.sku}>
                      {p.sku} — {p.name} (On-hand: {p.on_hand}, Avail: {p.available}) {isLow ? '⚠️ LOW' : ''}
                    </option>
                  )
                })}
              </select>
            </label>

            {selectedProduct && (
              <div className="product-preview-box">
                <div className="product-preview-row">
                  <span className="preview-label">Product Name:</span>
                  <strong>{selectedProduct.name}</strong>
                </div>
                <div className="product-preview-row">
                  <span className="preview-label">Category:</span>
                  <span>{selectedProduct.category || 'General'}</span>
                </div>
                <div className="product-preview-row">
                  <span className="preview-label">Unit Price:</span>
                  <span>{formatCurrency(selectedProduct.unit_price)}</span>
                </div>
                <div className="product-preview-stats">
                  <div className="stat-pill">
                    <small>On Hand</small>
                    <strong>{selectedProduct.on_hand}</strong>
                  </div>
                  <div className="stat-pill">
                    <small>Reserved</small>
                    <strong>{selectedProduct.reserved}</strong>
                  </div>
                  <div className="stat-pill stat-pill--highlight">
                    <small>Available</small>
                    <strong>{selectedProduct.available}</strong>
                  </div>
                </div>
              </div>
            )}

            <div className="form-row">
              <label className="form-field">
                <span>Received Quantity <span className="required">*</span></span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  disabled={submitting}
                  placeholder="e.g. 25"
                />
              </label>

              <label className="form-field">
                <span>Reference / PO Number</span>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  disabled={submitting}
                  placeholder="e.g. PO-2026-884"
                />
              </label>
            </div>

            <div className="form-actions">
              <button
                type="submit"
                className="button button--primary button--large"
                disabled={submitting || !selectedSku}
              >
                <Icon name="packagePlus" size={17} />
                {submitting ? 'Recording intake…' : 'Confirm Stock Receipt'}
              </button>
            </div>
          </form>
        </section>

        {/* Recent Inbound Receipts Table */}
        <section className="dashboard-card history-card">
          <div className="card-header">
            <div>
              <h2>Recent Inbound Movements</h2>
              <p>Generated dynamically from stock intake operations.</p>
            </div>
            <span className="badge badge--neutral">{recentReceipts.length} recorded</span>
          </div>

          <div className="table-scroll">
            <table className="products-table compact-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Product</th>
                  <th>SKU</th>
                  <th className="numeric">Intake Qty</th>
                  <th className="numeric">Avail After</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                {recentReceipts.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: '#888' }}>
                      No stock receipts recorded yet.
                    </td>
                  </tr>
                ) : (
                  recentReceipts.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <span className="timestamp-text">
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </td>
                      <td><strong>{m.productName}</strong></td>
                      <td><span className="sku-label">{m.productSku}</span></td>
                      <td className="numeric">
                        <span className="qty-positive">+{m.quantityChange}</span>
                      </td>
                      <td className="numeric">
                        <strong className="available-value">{m.availableAfter}</strong>
                      </td>
                      <td>
                        <small className="muted-text">{m.description}</small>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}

export default StockReceivingView
