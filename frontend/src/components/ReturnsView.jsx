import { useState } from 'react'
import Icon from './Icon.jsx'

function ReturnsView({ orders, products, onProcessReturn, movements = [], isLiveMode = false }) {
  // Only CONFIRMED or COMPLETED orders are eligible for return
  const eligibleOrders = orders.filter(
    (o) => o.status === 'CONFIRMED' || o.status === 'COMPLETED'
  )

  const [selectedOrderId, setSelectedOrderId] = useState(eligibleOrders[0]?.id || '')
  const selectedOrder = eligibleOrders.find((o) => o.id === selectedOrderId) || eligibleOrders[0]

  const [selectedSku, setSelectedSku] = useState(selectedOrder?.items[0]?.productSku || '')
  const [returnQty, setReturnQty] = useState('1')
  const [reason, setReason] = useState('Customer returned item (unopened)')
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const selectedItem = selectedOrder?.items.find((i) => i.productSku === selectedSku) || selectedOrder?.items[0]

  const handleOrderChange = (orderId) => {
    setSelectedOrderId(orderId)
    const ord = eligibleOrders.find((o) => o.id === orderId)
    if (ord && ord.items.length > 0) {
      setSelectedSku(ord.items[0].productSku)
    }
    setFeedback(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)

    if (!selectedOrder) {
      setFeedback({ type: 'error', message: 'No eligible order selected.' })
      return
    }

    if (!selectedItem) {
      setFeedback({ type: 'error', message: 'No order item selected.' })
      return
    }

    const qty = parseInt(returnQty, 10)
    if (!Number.isInteger(qty) || qty <= 0) {
      setFeedback({ type: 'error', message: 'Return quantity must be a positive integer.' })
      return
    }

    if (qty > selectedItem.quantity) {
      setFeedback({
        type: 'error',
        message: `Return quantity (${qty}) cannot exceed the ordered quantity (${selectedItem.quantity}).`,
      })
      return
    }

    setSubmitting(true)
    try {
      const updatedProduct = await onProcessReturn({
        orderId: selectedOrder.id,
        productId: selectedItem.productId,
        productSku: selectedItem.productSku,
        quantity: qty,
        reason: reason.trim() || 'Customer return',
        performedBy: 'manager',
      })

      const onHandDisplay = updatedProduct?.on_hand ?? updatedProduct?.availableAfter ?? 'restored'
      const availableDisplay = updatedProduct?.available ?? updatedProduct?.availableAfter ?? 'restored'

      setFeedback({
        type: 'success',
        message: `Successfully returned ${qty} unit(s) of "${selectedItem.productName}" from order ${selectedOrder.orderNumber}. Stock on-hand restored to ${onHandDisplay} (Available: ${availableDisplay}).`,
      })
      setReturnQty('1')
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to process return.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  // Filter recent return movements
  const returnMovements = movements.filter((m) => m.type === 'RETURN')

  return (
    <div className="returns-view">
      <div className={`demo-banner ${isLiveMode ? 'demo-banner--live' : 'demo-banner--isolated'}`} role="status">
        <Icon name={isLiveMode ? 'database' : 'return'} size={18} />
        <div>
          <strong>
            {isLiveMode ? 'LIVE POSTGRESQL RETURNS PROCESSING' : 'DEMO RETURNS PROCESSING — P4 WORKFLOW ONLY'}
          </strong>
          <span className="demo-banner__detail">
            {isLiveMode
              ? 'Validates against confirmed PostgreSQL order items and restores available inventory atomically, recording stock_transactions, ledger, and audit history.'
              : 'Demonstrates retail return processing: restores physical stock (on_hand += qty, available += qty), validates against order quantity, and records an immutable return movement.'}
          </span>
        </div>
      </div>

      <div className="two-column-layout">
        {/* Return Submission Card */}
        <section className="dashboard-card form-card">
          <div className="card-header">
            <div>
              <h2>Process Order Return</h2>
              <p>Select a confirmed customer order to return merchandise into inventory.</p>
            </div>
            <span className="badge badge--violet">Workflow E</span>
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

          {eligibleOrders.length === 0 ? (
            <div className="empty-state-box">
              <Icon name="alert" size={24} />
              <p>No confirmed orders are available to return.</p>
              <small>Confirm a pending order first in the Transactions view.</small>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="return-form">
              <label className="form-field">
                <span>Select Confirmed Order <span className="required">*</span></span>
                <select
                  value={selectedOrderId}
                  onChange={(e) => handleOrderChange(e.target.value)}
                  disabled={submitting}
                  className="select-input"
                >
                  {eligibleOrders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.orderNumber} — {o.customerName} ({o.items.length} items, ₹{o.totalAmount})
                    </option>
                  ))}
                </select>
              </label>

              {selectedOrder && (
                <div className="product-preview-box">
                  <div className="product-preview-row">
                    <span className="preview-label">Customer:</span>
                    <strong>{selectedOrder.customerName}</strong>
                  </div>
                  <div className="product-preview-row">
                    <span className="preview-label">Order Date:</span>
                    <span>{new Date(selectedOrder.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="product-preview-row">
                    <span className="preview-label">Order Status:</span>
                    <span className={`status-badge status-badge--${selectedOrder.status.toLowerCase()}`}>
                      {selectedOrder.status}
                    </span>
                  </div>
                </div>
              )}

              {selectedOrder && (
                <label className="form-field">
                  <span>Select Item to Return <span className="required">*</span></span>
                  <select
                    value={selectedSku}
                    onChange={(e) => {
                      setSelectedSku(e.target.value)
                      setFeedback(null)
                    }}
                    disabled={submitting}
                    className="select-input"
                  >
                    {selectedOrder.items.map((i) => (
                      <option key={i.productSku} value={i.productSku}>
                        {i.productName} (SKU: {i.productSku}) — Ordered: {i.quantity} unit(s)
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className="form-row">
                <label className="form-field">
                  <span>Return Quantity <span className="required">*</span></span>
                  <input
                    type="number"
                    min="1"
                    max={selectedItem?.quantity || 1}
                    step="1"
                    required
                    value={returnQty}
                    onChange={(e) => setReturnQty(e.target.value)}
                    disabled={submitting}
                  />
                  <small className="field-hint">
                    Maximum eligible: {selectedItem?.quantity || 1} unit(s)
                  </small>
                </label>

                <label className="form-field flex-grow">
                  <span>Reason for Return</span>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    disabled={submitting}
                    placeholder="e.g. Defective item, customer changed mind"
                  />
                </label>
              </div>

              <div className="form-actions">
                <button
                  type="submit"
                  className="button button--primary button--large"
                  disabled={submitting || !selectedOrder || !selectedItem}
                >
                  <Icon name="return" size={17} />
                  {submitting ? 'Processing return…' : 'Process Stock Return'}
                </button>
              </div>
            </form>
          )}
        </section>

        {/* Return History Card */}
        <section className="dashboard-card history-card">
          <div className="card-header">
            <div>
              <h2>Recent Returns Log</h2>
              <p>Merchandise restored to inventory.</p>
            </div>
            <span className="badge badge--neutral">{returnMovements.length} recorded</span>
          </div>

          <div className="table-scroll">
            <table className="products-table compact-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Product</th>
                  <th>SKU</th>
                  <th className="numeric">Returned Qty</th>
                  <th className="numeric">Avail After</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {returnMovements.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: '#888' }}>
                      No returns have been processed yet.
                    </td>
                  </tr>
                ) : (
                  returnMovements.map((m) => (
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

export default ReturnsView
