import { useState } from 'react'
import Icon from './Icon.jsx'

function formatCurrency(value) {
  const price = Number(value)
  if (!Number.isFinite(price) || price < 0) return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(price)
}

function TransactionsView({
  orders,
  products,
  onReserveStock,
  onConfirmOrder,
  onCancelOrder,
  role = 'staff',
  isLiveMode = false,
}) {
  const [activeTab, setActiveTab] = useState('orders') // 'orders' | 'new-order'
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [feedback, setFeedback] = useState(null)

  // New Order Form State
  const [customerName, setCustomerName] = useState('')
  const [orderItems, setOrderItems] = useState([
    { productSku: products[0]?.sku || '', quantity: '1' },
  ])
  const [submittingOrder, setSubmittingOrder] = useState(false)

  const handleAddItemRow = () => {
    setOrderItems((current) => [
      ...current,
      { productSku: products[0]?.sku || '', quantity: '1' },
    ])
  }

  const handleRemoveItemRow = (index) => {
    setOrderItems((current) => current.filter((_, i) => i !== index))
  }

  const handleItemChange = (index, field, value) => {
    setOrderItems((current) => {
      const next = [...current]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  const handleCreateOrderSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)

    if (!customerName.trim()) {
      setFeedback({ type: 'error', message: 'Customer name is required.' })
      return
    }

    if (orderItems.length === 0) {
      setFeedback({ type: 'error', message: 'At least one item is required.' })
      return
    }

    // Validate quantities against availability
    for (const item of orderItems) {
      const qty = parseInt(item.quantity, 10)
      if (!Number.isInteger(qty) || qty <= 0) {
        setFeedback({
          type: 'error',
          message: `Quantity for SKU ${item.productSku} must be a positive integer.`,
        })
        return
      }
      const prod = products.find((p) => p.sku === item.productSku)
      if (!prod) {
        setFeedback({ type: 'error', message: `Product ${item.productSku} not found.` })
        return
      }
      if (qty > prod.available) {
        setFeedback({
          type: 'error',
          message: `Cannot reserve ${qty} of "${prod.name}" (SKU: ${prod.sku}). Only ${prod.available} unit(s) available in stock.`,
        })
        return
      }
    }

    setSubmittingOrder(true)
    try {
      const created = await onReserveStock({
        customerName: customerName.trim(),
        items: orderItems.map((item) => ({
          productSku: item.productSku,
          quantity: parseInt(item.quantity, 10),
        })),
        performedBy: role,
      })

      setFeedback({
        type: 'success',
        message: `Order ${created?.orderNumber || 'created'} placed for ${created?.customerName || customerName.trim()}. Stock items successfully reserved!`,
      })
      setCustomerName('')
      setOrderItems([{ productSku: products[0]?.sku || '', quantity: '1' }])
      setActiveTab('orders')
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to place reservation.',
      })
    } finally {
      setSubmittingOrder(false)
    }
  }

  const handleConfirmOrder = async (orderId) => {
    setFeedback(null)
    try {
      const confirmed = await onConfirmOrder({ orderId, performedBy: role })
      setFeedback({
        type: 'success',
        message: `Order ${confirmed?.orderNumber || orderId} confirmed. Physical stock decremented consistently.`,
      })
      if (selectedOrder?.id === orderId && confirmed) {
        setSelectedOrder(confirmed)
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to confirm order.',
      })
    }
  }

  const handleCancelOrder = async (orderId) => {
    setFeedback(null)
    try {
      const cancelled = await onCancelOrder({ orderId, performedBy: role })
      setFeedback({
        type: 'success',
        message: `Order ${cancelled?.orderNumber || orderId} cancelled. All reserved items released back to available inventory.`,
      })
      if (selectedOrder?.id === orderId && cancelled) {
        setSelectedOrder(cancelled)
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to cancel order.',
      })
    }
  }

  const filteredOrders = orders.filter((o) => {
    if (statusFilter === 'ALL') return true
    return o.status === statusFilter
  })

  // Calculate total active order value
  const totalOrderValue = orders.reduce(
    (sum, o) => sum + (o.status !== 'CANCELLED' ? Number(o.totalAmount || 0) : 0),
    0
  )

  return (
    <div className="transactions-view">
      <div className={`demo-banner ${isLiveMode ? 'demo-banner--live' : 'demo-banner--isolated'}`} role="status">
        <Icon name={isLiveMode ? 'database' : 'receipt'} size={18} />
        <div>
          <strong>
            {isLiveMode ? 'LIVE POSTGRESQL ORDER PROCESSING & RESERVATIONS' : 'DEMO TRANSACTIONS & ORDER RESERVATIONS — P4 WORKFLOW ONLY'}
          </strong>
          <span className="demo-banner__detail">
            {isLiveMode
              ? 'Real PostgreSQL database orders with atomic inventory reservation lifecycle: PENDING (reserves available) -> CONFIRMED (deducts on-hand) or CANCELLED (releases reservation).'
              : 'Demonstrates atomic reservation lifecycle: PENDING (reserves stock) -> CONFIRMED (deducts stock) or CANCELLED (releases stock). Sample in-memory mode.'}
          </span>
        </div>
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

      {/* Top Controls / Tabs */}
      <div className="view-header-bar">
        <div className="tab-buttons">
          <button
            type="button"
            className={`tab-button ${activeTab === 'orders' ? 'tab-button--active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            <Icon name="receipt" size={16} />
            Orders List ({orders.length})
          </button>
          <button
            type="button"
            className={`tab-button ${activeTab === 'new-order' ? 'tab-button--active' : ''}`}
            onClick={() => setActiveTab('new-order')}
          >
            <Icon name="plus" size={16} />
            Place New Order &amp; Reserve Stock
          </button>
        </div>

        {activeTab === 'orders' && (
          <div className="filter-group">
            <span className="filter-label">Filter status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="select-input select-input--compact"
            >
              <option value="ALL">All Orders ({orders.length})</option>
              <option value="PENDING">Pending Only</option>
              <option value="CONFIRMED">Confirmed Only</option>
              <option value="CANCELLED">Cancelled Only</option>
            </select>
          </div>
        )}
      </div>

      {/* VIEW 1: ORDERS LIST */}
      {activeTab === 'orders' && (
        <section className="dashboard-card">
          <div className="card-header">
            <div>
              <h2>Customer Orders &amp; Reservation Register</h2>
              <p>Total active turnover: {formatCurrency(totalOrderValue)}</p>
            </div>
            <span className="badge badge--neutral">{filteredOrders.length} displayed</span>
          </div>

          <div className="table-scroll">
            <table className="products-table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th className="numeric">Total Amount</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th>Date &amp; Time</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: '#888' }}>
                      No orders found matching the selected filter.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => {
                    const isPending = order.status === 'PENDING'
                    const isConfirmed = order.status === 'CONFIRMED'
                    const isCancelled = order.status === 'CANCELLED'

                    return (
                      <tr key={order.id} className={isPending ? 'order-pending-row' : ''}>
                        <td>
                          <button
                            type="button"
                            className="link-button"
                            onClick={() => setSelectedOrder(order)}
                          >
                            <strong>{order.orderNumber}</strong>
                          </button>
                        </td>
                        <td>
                          <div className="customer-info">
                            <span className="customer-avatar">{order.customerName[0]?.toUpperCase()}</span>
                            <span>{order.customerName}</span>
                          </div>
                        </td>
                        <td>
                          <span className="order-items-summary">
                            {order.items.map((i) => `${i.quantity}x ${i.productSku}`).join(', ')}
                          </span>
                        </td>
                        <td className="numeric">
                          <strong>{formatCurrency(order.totalAmount)}</strong>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`status-badge status-badge--${order.status.toLowerCase()}`}>
                            {order.status}
                          </span>
                        </td>
                        <td>
                          <span className="timestamp-text">
                            {new Date(order.createdAt).toLocaleDateString()} {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div className="action-buttons-cell">
                            <button
                              type="button"
                              className="button button--secondary button--compact"
                              onClick={() => setSelectedOrder(order)}
                              title="View Order Details"
                            >
                              Details
                            </button>
                            {isPending && (
                              <>
                                <button
                                  type="button"
                                  className="button button--primary button--compact"
                                  onClick={() => handleConfirmOrder(order.id)}
                                  title="Confirm order & consume stock"
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  className="button button--danger button--compact"
                                  onClick={() => handleCancelOrder(order.id)}
                                  title="Cancel order & release stock"
                                >
                                  Cancel
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* VIEW 2: NEW ORDER & RESERVE STOCK FORM */}
      {activeTab === 'new-order' && (
        <section className="dashboard-card form-card">
          <div className="card-header">
            <div>
              <h2>Create Customer Order &amp; Reserve Inventory</h2>
              <p>Stock will be atomically reserved in real time. Available quantity will decrease immediately.</p>
            </div>
            <span className="badge badge--green">Workflow B</span>
          </div>

          <form onSubmit={handleCreateOrderSubmit} className="order-form">
            <label className="form-field">
              <span>Customer Name <span className="required">*</span></span>
              <input
                type="text"
                required
                placeholder="e.g. Rohith Verma"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                disabled={submittingOrder}
              />
            </label>

            <div className="order-line-items">
              <div className="line-items-header">
                <h3>Order Line Items</h3>
                <button
                  type="button"
                  className="button button--secondary button--compact"
                  onClick={handleAddItemRow}
                  disabled={submittingOrder}
                >
                  <Icon name="plus" size={14} /> Add Another Product
                </button>
              </div>

              {orderItems.map((item, idx) => {
                const prod = products.find((p) => p.sku === item.productSku)
                const qty = parseInt(item.quantity, 10) || 0
                const isInsufficient = prod && qty > prod.available

                return (
                  <div key={idx} className="line-item-row">
                    <label className="form-field flex-grow">
                      <span>Product ({idx + 1})</span>
                      <select
                        value={item.productSku}
                        onChange={(e) => handleItemChange(idx, 'productSku', e.target.value)}
                        disabled={submittingOrder}
                        className="select-input"
                      >
                        {products.map((p) => (
                          <option key={p.sku} value={p.sku}>
                            {p.sku} — {p.name} (Avail: {p.available}, Price: ₹{p.unit_price})
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="form-field qty-field">
                      <span>Quantity</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        required
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                        disabled={submittingOrder}
                      />
                    </label>

                    <div className="line-item-info">
                      <span className="line-item-price">
                        ₹{prod ? (Number(prod.unit_price) * qty).toFixed(2) : '0.00'}
                      </span>
                      <span className={`line-item-avail ${isInsufficient ? 'qty-negative' : 'qty-positive'}`}>
                        {prod ? `${prod.available} avail` : ''}
                      </span>
                    </div>

                    {orderItems.length > 1 && (
                      <button
                        type="button"
                        className="icon-button delete-row-btn"
                        onClick={() => handleRemoveItemRow(idx)}
                        title="Remove item"
                        disabled={submittingOrder}
                      >
                        <Icon name="close" size={16} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="order-summary-box">
              <div className="order-summary-row">
                <span>Total Items:</span>
                <strong>{orderItems.reduce((acc, i) => acc + (parseInt(i.quantity, 10) || 0), 0)} unit(s)</strong>
              </div>
              <div className="order-summary-row total-row">
                <span>Estimated Total:</span>
                <strong className="total-amount-display">
                  ₹{orderItems.reduce((sum, item) => {
                    const prod = products.find((p) => p.sku === item.productSku)
                    return sum + (prod ? Number(prod.unit_price) * (parseInt(item.quantity, 10) || 0) : 0)
                  }, 0).toFixed(2)}
                </strong>
              </div>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="button button--secondary"
                onClick={() => setActiveTab('orders')}
                disabled={submittingOrder}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="button button--primary button--large"
                disabled={submittingOrder}
              >
                <Icon name="clock" size={17} />
                {submittingOrder ? 'Reserving Stock…' : 'Place Order & Reserve Stock'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* ORDER DETAILS MODAL */}
      {selectedOrder && (
        <div className="modal-backdrop" onClick={() => setSelectedOrder(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>Order Details: {selectedOrder.orderNumber}</h2>
                <span className={`status-badge status-badge--${selectedOrder.status.toLowerCase()}`}>
                  {selectedOrder.status}
                </span>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setSelectedOrder(null)}
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="order-meta-grid">
                <div>
                  <small>Customer Name</small>
                  <strong>{selectedOrder.customerName}</strong>
                </div>
                <div>
                  <small>Created At</small>
                  <span>{new Date(selectedOrder.createdAt).toLocaleString()}</span>
                </div>
                <div>
                  <small>Placed By</small>
                  <span>{selectedOrder.placedBy}</span>
                </div>
                <div>
                  <small>Total Amount</small>
                  <strong className="available-value">{formatCurrency(selectedOrder.totalAmount)}</strong>
                </div>
              </div>

              <h3>Ordered Items</h3>
              <table className="products-table compact-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th className="numeric">Quantity</th>
                    <th className="numeric">Unit Price</th>
                    <th className="numeric">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrder.items.map((item, i) => (
                    <tr key={i}>
                      <td><strong>{item.productName}</strong></td>
                      <td><span className="sku-label">{item.productSku}</span></td>
                      <td className="numeric">{item.quantity}</td>
                      <td className="numeric">{formatCurrency(item.unitPrice)}</td>
                      <td className="numeric">
                        <strong>{formatCurrency(Number(item.unitPrice) * item.quantity)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {selectedOrder.status === 'PENDING' && (
                <div className="modal-actions-bar">
                  <p className="form-note">
                    Stock is currently <strong>RESERVED</strong>. Confirming will consume physical stock; cancelling will release reservations.
                  </p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="button button--danger"
                      onClick={() => handleCancelOrder(selectedOrder.id)}
                    >
                      Cancel Order (Release Stock)
                    </button>
                    <button
                      type="button"
                      className="button button--primary"
                      onClick={() => handleConfirmOrder(selectedOrder.id)}
                    >
                      Confirm Order (Consume Stock)
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="button button--secondary"
                onClick={() => setSelectedOrder(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TransactionsView
