import { useState } from 'react'
import Icon from './Icon.jsx'
import { LOW_STOCK_THRESHOLD } from '../demo/demo-data.js'

function formatCurrency(value) {
  if (value === undefined || value === null || value === '') return '—'
  const price = Number(value)
  if (!Number.isFinite(price) || price < 0) return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(price)
}

function ProductDetailDialog({
  product,
  canEdit = false,
  isEditingInitially = false,
  onClose,
  onSave,
}) {
  const [isEditing, setIsEditing] = useState(isEditingInitially && canEdit)
  const [name, setName] = useState(product?.name || '')
  const [category, setCategory] = useState(product?.category || '')
  const [unitPrice, setUnitPrice] = useState(product?.unit_price || '')
  const [error, setError] = useState('')

  if (!product) return null

  const onHand = Number(product.on_hand) || 0
  const reserved = Number(product.reserved) || 0
  const available = Number(product.available) || 0
  const isLowStock = onHand <= LOW_STOCK_THRESHOLD

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')

    const trimmedName = name.trim()
    const priceNum = Number(unitPrice)

    if (!trimmedName) {
      setError('Product name cannot be empty.')
      return
    }
    if (isNaN(priceNum) || priceNum < 0) {
      setError('Unit price must be a non-negative decimal value.')
      return
    }

    try {
      onSave({
        sku: product.sku,
        name: trimmedName,
        category: category.trim() || null,
        unit_price: priceNum.toFixed(2),
      })
      setIsEditing(false)
    } catch (err) {
      setError(err.message || 'Failed to save product.')
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <section
        className="product-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-detail-title"
      >
        <div className="product-dialog__header">
          <div>
            <span className="dialog-icon"><Icon name="box" size={20} /></span>
            <h2 id="product-detail-title">
              {isEditing ? 'Edit Product' : 'Product Details'}
            </h2>
            <p className="eyebrow" style={{ marginTop: '2px', marginBottom: 0 }}>
              SKU: {product.sku}
            </p>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <Icon name="close" size={19} />
          </button>
        </div>

        {error && <div className="form-api-error" role="alert">{error}</div>}

        {isLowStock && (
          <div className="demo-banner-top" style={{ marginBottom: '12px' }}>
            <Icon name="alert" size={16} />
            <span>
              <strong>Low stock warning:</strong> Only {onHand} units on hand ({available} available). Restocking recommended.
            </span>
          </div>
        )}

        {isEditing ? (
          <form className="product-form" onSubmit={handleSubmit}>
            <label className="form-field">
              <span>SKU</span>
              <input value={product.sku} disabled readOnly style={{ background: 'var(--surface-alt, #f9fafb)' }} />
            </label>

            <label className="form-field">
              <span>Product Name <span className="required">*</span></span>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>

            <label className="form-field">
              <span>Category</span>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Electronics"
              />
            </label>

            <label className="form-field">
              <span>Unit Price (₹) <span className="required">*</span></span>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
              />
            </label>

            <div className="product-form__actions">
              <button
                type="button"
                className="button button--secondary"
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </button>
              <button type="submit" className="button button--primary">
                Save Changes
              </button>
            </div>
          </form>
        ) : (
          <div className="detail-view">
            <div className="detail-fields">
              <div className="detail-field">
                <label>Product Name</label>
                <div className="field-value" style={{ fontWeight: 600 }}>{product.name}</div>
              </div>
              <div className="detail-field">
                <label>Category</label>
                <div className="field-value">{product.category || 'Uncategorized'}</div>
              </div>
              <div className="detail-field">
                <label>Unit Price</label>
                <div className="field-value" style={{ fontSize: '18px', fontWeight: 700 }}>
                  {formatCurrency(product.unit_price)}
                </div>
              </div>
            </div>

            <div style={{ marginTop: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary, #6b7280)', textTransform: 'uppercase' }}>
                Stock Quantities (Live Inventory State)
              </label>
              <div className="stock-summary">
                <div className="stock-summary__item">
                  <span className="stock-summary__label">On Hand</span>
                  <span className="stock-summary__value">{onHand}</span>
                </div>
                <div className="stock-summary__item">
                  <span className="stock-summary__label">Reserved</span>
                  <span className="stock-summary__value">{reserved}</span>
                </div>
                <div className="stock-summary__item">
                  <span className="stock-summary__label">Available</span>
                  <span className="stock-summary__value" style={{ color: available > 0 ? '#059669' : '#dc2626' }}>
                    {available}
                  </span>
                </div>
              </div>
              <p className="form-note" style={{ marginTop: '6px' }}>
                Formula verified: <code>available ({available}) = on_hand ({onHand}) - reserved ({reserved})</code>
              </p>
            </div>

            <div className="product-form__actions" style={{ marginTop: '20px' }}>
              {canEdit && (
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => setIsEditing(true)}
                >
                  Edit Product
                </button>
              )}
              <button
                type="button"
                className="button button--primary"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

export default ProductDetailDialog
