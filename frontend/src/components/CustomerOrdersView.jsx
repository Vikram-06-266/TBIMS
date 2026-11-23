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

function CustomerOrdersView({
  orders = [],
  loading = false,
  error = null,
  onCancelOrder,
  onNavigate,
}) {
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [cancellingId, setCancellingId] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [confirmCancelModalOrder, setConfirmCancelModalOrder] = useState(null)

  const handleConfirmCancel = async () => {
    if (!confirmCancelModalOrder) return
    const orderId = confirmCancelModalOrder.id
    setCancellingId(orderId)
    setFeedback(null)

    try {
      await onCancelOrder(orderId)
      setFeedback({
        type: 'success',
        message: `Order ${confirmCancelModalOrder.orderNumber || orderId} has been cancelled and reserved stock has been released.`,
      })
      setConfirmCancelModalOrder(null)
      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev) => ({ ...prev, status: 'CANCELLED' }))
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to cancel order.',
      })
    } finally {
      setCancellingId(null)
    }
  }

  return (
    <div className="customer-orders-view">
      <div className="cart-header-row">
        <div>
          <h2>My Order History ({orders.length})</h2>
          <p>Track status, view reservation receipts, or manage pending orders.</p>
        </div>
        <button
          type="button"
          className="button button--secondary button--compact"
          onClick={() => onNavigate('shop')}
        >
          <Icon name="box" size={16} /> Continue Shopping
        </button>
      </div>

      {feedback && (
        <div className={`notice notice--${feedback.type}`} role="alert" style={{ marginTop: '14px' }}>
          <Icon name={feedback.type === 'error' ? 'alert' : 'check'} size={18} />
          <span>{feedback.message}</span>
        </div>
      )}

      {loading ? (
        <div className="table-state" style={{ marginTop: '30px' }}>
          <span className="spinner" />
          <strong>Loading your order history...</strong>
        </div>
      ) : error ? (
        <div className="table-state table-state--error" style={{ marginTop: '30px' }}>
          <Icon name="alert" size={24} />
          <strong>Failed to load orders</strong>
          <span>{error.message || 'Could not retrieve your orders.'}</span>
        </div>
      ) : orders.length === 0 ? (
        <div className="empty-state-notice" style={{ marginTop: '30px' }}>
          <Icon name="receipt" size={32} />
          <span>You have not placed any orders yet.</span>
          <button
            type="button"
            className="button button--primary"
            onClick={() => onNavigate('shop')}
            style={{ marginTop: '14px' }}
          >
            Start Shopping Now
          </button>
        </div>
      ) : (
        <div className="table-scroll" style={{ marginTop: '20px' }}>
          <table className="products-table">
            <thead>
              <tr>
                <th>Order Reference</th>
                <th>Date Placed</th>
                <th>Items Ordered</th>
                <th className="numeric">Total Amount</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const isPending = order.status === 'PENDING'
                const isConfirmed = order.status === 'CONFIRMED' || order.status === 'COMPLETED'
                const isCancelled = order.status === 'CANCELLED'

                return (
                  <tr key={order.id}>
                    <td>
                      <strong>{order.orderNumber || `ORD-2026-${order.id}`}</strong>
                    </td>
                    <td>
                      <span className="timestamp-text">
                        {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '—'}
                      </span>
                    </td>
                    <td>
                      <small className="muted-text">
                        {order.items && order.items.length > 0
                          ? order.items.map((i) => `${i.quantity}x ${i.productName || i.productSku}`).join(', ')
                          : '1 item'}
                      </small>
                    </td>
                    <td className="numeric">
                      <strong>{formatCurrency(order.totalAmount)}</strong>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`status-badge status-badge--${order.status.toLowerCase()}`}>
                        {order.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        <button
                          type="button"
                          className="button button--secondary button--compact"
                          onClick={() => setSelectedOrder(order)}
                          title="View order details"
                        >
                          View Details
                        </button>
                        {isPending && (
                          <button
                            type="button"
                            className="button button--danger button--compact"
                            disabled={cancellingId === order.id}
                            onClick={() => setConfirmCancelModalOrder(order)}
                            title="Cancel pending order and release reserved stock"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="modal-backdrop" onClick={() => setSelectedOrder(null)}>
          <div className="modal-dialog modal-dialog--md" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>Order Details</h2>
                <p className="eyebrow" style={{ margin: 0 }}>
                  {selectedOrder.orderNumber || `ORD-2026-${selectedOrder.id}`}
                </p>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div>
                  <span className="muted-text">Status: </span>
                  <span className={`status-badge status-badge--${selectedOrder.status.toLowerCase()}`}>
                    {selectedOrder.status}
                  </span>
                </div>
                <div>
                  <span className="muted-text">Date: </span>
                  <strong>{selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleString() : '—'}</strong>
                </div>
              </div>

              <h4 style={{ margin: '0 0 8px' }}>Order Line Items</h4>
              <div className="table-scroll">
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
                    {selectedOrder.items?.map((item, idx) => (
                      <tr key={item.orderItemId || idx}>
                        <td>{item.productName || 'Product item'}</td>
                        <td><span className="product-sku-pill">{item.productSku || '—'}</span></td>
                        <td className="numeric">{item.quantity}</td>
                        <td className="numeric">{formatCurrency(item.unitPrice)}</td>
                        <td className="numeric">
                          <strong>{formatCurrency(Number(item.unitPrice) * item.quantity)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ textAlign: 'right', marginTop: '16px', fontSize: '16px' }}>
                <span className="muted-text">Grand Total: </span>
                <strong style={{ color: 'var(--brand-primary, #2563eb)' }}>
                  {formatCurrency(selectedOrder.totalAmount)}
                </strong>
              </div>

              {selectedOrder.status === 'CONFIRMED' && (
                <div className="notice notice--info" style={{ marginTop: '16px' }}>
                  <Icon name="check" size={18} />
                  <div>
                    <strong>Order Confirmed &amp; Dispatched: </strong>
                    <span>
                      Merchandise has been fulfilled from the warehouse. To request an eligible return, please contact customer support or visit store inventory management with this order reference.
                    </span>
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
              {selectedOrder.status === 'PENDING' && (
                <button
                  type="button"
                  className="button button--danger"
                  onClick={() => {
                    setConfirmCancelModalOrder(selectedOrder)
                    setSelectedOrder(null)
                  }}
                >
                  Cancel Order
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Cancelling Order */}
      {confirmCancelModalOrder && (
        <div className="modal-backdrop" onClick={() => setConfirmCancelModalOrder(null)}>
          <div className="modal-dialog modal-dialog--sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Confirm Order Cancellation</h2>
              <button
                type="button"
                className="icon-button"
                onClick={() => setConfirmCancelModalOrder(null)}
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to cancel order <strong>{confirmCancelModalOrder.orderNumber || confirmCancelModalOrder.id}</strong>?
              </p>
              <p className="form-note">
                This will release the reserved inventory units back to available stock immediately.
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="button button--secondary"
                disabled={cancellingId !== null}
                onClick={() => setConfirmCancelModalOrder(null)}
              >
                Keep Order
              </button>
              <button
                type="button"
                className="button button--danger"
                disabled={cancellingId !== null}
                onClick={handleConfirmCancel}
              >
                {cancellingId ? 'Cancelling…' : 'Yes, Cancel Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CustomerOrdersView
