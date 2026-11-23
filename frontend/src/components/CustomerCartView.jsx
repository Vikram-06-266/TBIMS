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

function CustomerCartView({
  cart = [],
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onCheckout,
  onNavigate,
}) {
  const [checkingOut, setCheckingOut] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [confirmedOrder, setConfirmedOrder] = useState(null)

  const subtotal = cart.reduce((sum, item) => {
    return sum + Number(item.product.unit_price) * item.quantity
  }, 0)

  const handleQuantityStep = (productId, newQty, max) => {
    if (newQty < 1) return
    if (max && newQty > max) return
    onUpdateQuantity(productId, newQty)
  }

  const handleCheckoutSubmit = async () => {
    if (cart.length === 0) return
    setCheckingOut(true)
    setFeedback(null)

    try {
      const order = await onCheckout(cart)
      setConfirmedOrder(order)
      onClearCart()
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to complete checkout. Please review quantities and try again.',
      })
    } finally {
      setCheckingOut(false)
    }
  }

  if (confirmedOrder) {
    return (
      <div className="order-confirmation-card">
        <div className="confirmation-icon-circle">
          <Icon name="check" size={32} />
        </div>
        <h2>Order Placed Successfully!</h2>
        <p className="order-number-display">
          Order Reference: <strong>{confirmedOrder.orderNumber || `ORD-2026-${confirmedOrder.id}`}</strong>
        </p>
        <p className="confirmation-note">
          Your inventory items have been securely reserved in our warehouse. Our fulfillment team will process your order shortly.
        </p>
        <div className="confirmation-actions">
          <button
            type="button"
            className="button button--primary"
            onClick={() => onNavigate('my-orders')}
          >
            <Icon name="receipt" size={17} /> View in My Orders
          </button>
          <button
            type="button"
            className="button button--secondary"
            onClick={() => {
              setConfirmedOrder(null)
              onNavigate('shop')
            }}
          >
            Continue Shopping
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="customer-cart-view">
      <div className="cart-header-row">
        <div>
          <h2>Your Shopping Cart ({cart.length} item{cart.length === 1 ? '' : 's'})</h2>
          <p>Review selected merchandise before confirming your reservation.</p>
        </div>
        {cart.length > 0 && (
          <button
            type="button"
            className="button button--secondary button--compact"
            onClick={onClearCart}
          >
            Clear Cart
          </button>
        )}
      </div>

      {feedback && (
        <div className={`notice notice--${feedback.type}`} role="alert" style={{ marginTop: '14px' }}>
          <Icon name={feedback.type === 'error' ? 'alert' : 'check'} size={18} />
          <span>{feedback.message}</span>
        </div>
      )}

      {cart.length === 0 ? (
        <div className="empty-cart-state">
          <div className="empty-cart-icon">
            <Icon name="cart" size={40} />
          </div>
          <h3>Your cart is empty</h3>
          <p>Browse our catalog to select products and reserve stock.</p>
          <button
            type="button"
            className="button button--primary"
            onClick={() => onNavigate('shop')}
            style={{ marginTop: '16px' }}
          >
            <Icon name="box" size={18} /> Browse Products
          </button>
        </div>
      ) : (
        <div className="cart-layout-grid" style={{ marginTop: '20px' }}>
          {/* Cart Items List */}
          <div className="cart-items-panel">
            <div className="table-scroll">
              <table className="products-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th className="numeric">Unit Price</th>
                    <th style={{ textAlign: 'center' }}>Quantity</th>
                    <th className="numeric">Line Total</th>
                    <th style={{ textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item) => {
                    const lineTotal = Number(item.product.unit_price) * item.quantity
                    const maxStock = item.product.available

                    return (
                      <tr key={item.product.id}>
                        <td>
                          <strong>{item.product.name}</strong>
                          {maxStock !== undefined && (
                            <small className="muted-text" style={{ display: 'block' }}>
                              {maxStock} available
                            </small>
                          )}
                        </td>
                        <td><span className="product-sku-pill">{item.product.sku}</span></td>
                        <td className="numeric">{formatCurrency(item.product.unit_price)}</td>
                        <td style={{ textAlign: 'center' }}>
                          <div className="qty-stepper" style={{ justifyContent: 'center' }}>
                            <button
                              type="button"
                              className="stepper-btn"
                              disabled={item.quantity <= 1 || checkingOut}
                              onClick={() => handleQuantityStep(item.product.id, item.quantity - 1, maxStock)}
                            >
                              &minus;
                            </button>
                            <input
                              type="number"
                              min="1"
                              max={maxStock}
                              value={item.quantity}
                              disabled={checkingOut}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10)
                                if (!isNaN(val) && val >= 1) {
                                  handleQuantityStep(item.product.id, Math.min(val, maxStock || val), maxStock)
                                }
                              }}
                              className="stepper-input"
                            />
                            <button
                              type="button"
                              className="stepper-btn"
                              disabled={(maxStock && item.quantity >= maxStock) || checkingOut}
                              onClick={() => handleQuantityStep(item.product.id, item.quantity + 1, maxStock)}
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="numeric">
                          <strong>{formatCurrency(lineTotal)}</strong>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="icon-button"
                            title="Remove from cart"
                            disabled={checkingOut}
                            onClick={() => onRemoveItem(item.product.id)}
                          >
                            <Icon name="close" size={16} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cart Summary & Checkout */}
          <div className="cart-summary-card">
            <h3>Order Summary</h3>
            <div className="summary-row">
              <span>Items Total:</span>
              <span>{cart.reduce((s, i) => s + i.quantity, 0)} units</span>
            </div>
            <div className="summary-row">
              <span>Subtotal:</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="summary-row">
              <span>Taxes &amp; Delivery:</span>
              <span className="free-tag">FREE</span>
            </div>
            <div className="summary-divider" />
            <div className="summary-row total-row">
              <strong>Order Total:</strong>
              <strong className="total-amount">{formatCurrency(subtotal)}</strong>
            </div>

            <button
              type="button"
              className="button button--primary checkout-submit-btn"
              disabled={checkingOut || cart.length === 0}
              onClick={handleCheckoutSubmit}
            >
              {checkingOut ? 'Reserving Stock & Placing Order…' : 'Proceed to Checkout'}
            </button>

            <div className="cart-trust-badge">
              <Icon name="lock" size={15} />
              <span>Real-time PostgreSQL atomic reservation guarantee</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CustomerCartView
