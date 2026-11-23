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

function CustomerShopView({
  products = [],
  loading = false,
  error = null,
  cart = [],
  onAddToCart,
  onNavigate,
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [itemQuantities, setItemQuantities] = useState({})
  const [addedNotice, setAddedNotice] = useState(null)

  const filteredProducts = products.filter((p) => {
    if (!searchTerm.trim()) return true
    const term = searchTerm.toLowerCase()
    return (
      p.name?.toLowerCase().includes(term) ||
      p.sku?.toLowerCase().includes(term)
    )
  })

  const getQuantity = (id) => itemQuantities[id] || 1

  const handleQuantityChange = (id, val, max) => {
    const parsed = parseInt(val, 10)
    if (isNaN(parsed) || parsed < 1) {
      setItemQuantities((prev) => ({ ...prev, [id]: 1 }))
    } else if (parsed > max) {
      setItemQuantities((prev) => ({ ...prev, [id]: max }))
    } else {
      setItemQuantities((prev) => ({ ...prev, [id]: parsed }))
    }
  }

  const handleAdd = (product) => {
    const qty = getQuantity(product.id)
    onAddToCart(product, qty)
    setAddedNotice(`Added ${qty}x "${product.name}" to cart.`)
    setTimeout(() => setAddedNotice(null), 3000)
  }

  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <div className="customer-shop-view">
      {/* Customer Header Banner */}
      <div className="customer-hero-card">
        <div>
          <h2>Online Retail Store</h2>
          <p>Browse our catalog of authentic merchandise, check stock, and place orders directly.</p>
        </div>
        <button
          type="button"
          className="button button--primary cart-shortcut-btn"
          onClick={() => onNavigate('cart')}
        >
          <Icon name="cart" size={18} />
          <span>Shopping Cart ({totalCartCount})</span>
        </button>
      </div>

      {addedNotice && (
        <div className="notice notice--success" role="status" style={{ marginTop: '16px' }}>
          <Icon name="check" size={18} />
          <span>{addedNotice}</span>
          <button
            type="button"
            className="link-button"
            onClick={() => onNavigate('cart')}
            style={{ marginLeft: '12px', fontWeight: 600 }}
          >
            View Cart &rarr;
          </button>
        </div>
      )}

      {/* Search & Filters */}
      <div className="shop-search-bar" style={{ marginTop: '20px' }}>
        <div className="search-field">
          <Icon name="search" size={18} />
          <input
            type="text"
            placeholder="Search products by title, description, or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              type="button"
              className="icon-button"
              onClick={() => setSearchTerm('')}
              aria-label="Clear search"
            >
              <Icon name="close" size={16} />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="table-state" style={{ marginTop: '30px' }}>
          <span className="spinner" />
          <strong>Loading store catalogue...</strong>
        </div>
      ) : error ? (
        <div className="table-state table-state--error" style={{ marginTop: '30px' }}>
          <Icon name="alert" size={24} />
          <strong>Failed to load store catalogue</strong>
          <span>{error.message || 'Please check backend connection.'}</span>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="empty-state-notice" style={{ marginTop: '30px' }}>
          <Icon name="box" size={24} />
          <span>No products found matching &ldquo;{searchTerm}&rdquo;. Try another search term.</span>
        </div>
      ) : (
        <div className="shop-grid" style={{ marginTop: '20px' }}>
          {filteredProducts.map((p) => {
            const isAvailable = Number(p.available) > 0
            const currentQty = getQuantity(p.id)

            return (
              <div key={p.id} className={`shop-product-card ${!isAvailable ? 'card-out-of-stock' : ''}`}>
                <div className="card-header-row">
                  <span className="product-sku-pill">{p.sku}</span>
                  <span className={`status-badge ${isAvailable ? 'status-badge--confirmed' : 'status-badge--cancelled'}`}>
                    {isAvailable ? `${p.available} in stock` : 'Out of Stock'}
                  </span>
                </div>

                <h3 className="card-product-title" title={p.name}>
                  {p.name}
                </h3>

                <div className="card-price-row">
                  <span className="price-tag">{formatCurrency(p.unit_price)}</span>
                </div>

                <div className="card-actions-row">
                  {isAvailable ? (
                    <>
                      <div className="qty-stepper">
                        <button
                          type="button"
                          className="stepper-btn"
                          disabled={currentQty <= 1}
                          onClick={() => handleQuantityChange(p.id, currentQty - 1, p.available)}
                        >
                          &minus;
                        </button>
                        <input
                          type="number"
                          min="1"
                          max={p.available}
                          value={currentQty}
                          onChange={(e) => handleQuantityChange(p.id, e.target.value, p.available)}
                          className="stepper-input"
                        />
                        <button
                          type="button"
                          className="stepper-btn"
                          disabled={currentQty >= p.available}
                          onClick={() => handleQuantityChange(p.id, currentQty + 1, p.available)}
                        >
                          +
                        </button>
                      </div>

                      <button
                        type="button"
                        className="button button--primary button--compact"
                        onClick={() => handleAdd(p)}
                      >
                        <Icon name="cart" size={16} /> Add to Cart
                      </button>
                    </>
                  ) : (
                    <button type="button" className="button button--secondary button--compact" disabled>
                      Unavailable
                    </button>
                  )}

                  <button
                    type="button"
                    className="button button--secondary button--compact"
                    onClick={() => setSelectedProduct(p)}
                    title="View Product Details"
                  >
                    Details
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div className="modal-backdrop" onClick={() => setSelectedProduct(null)}>
          <div className="modal-dialog modal-dialog--sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Product Information</h2>
              <button
                type="button"
                className="icon-button"
                onClick={() => setSelectedProduct(null)}
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '14px' }}>
                <span className="product-sku-pill">{selectedProduct.sku}</span>
                <h3 style={{ margin: '8px 0 4px', fontSize: '18px' }}>{selectedProduct.name}</h3>
                <p style={{ fontSize: '20px', fontWeight: 700, color: 'var(--brand-primary, #2563eb)' }}>
                  {formatCurrency(selectedProduct.unit_price)}
                </p>
              </div>

              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span className="muted-text">Availability:</span>
                  <strong>{Number(selectedProduct.available) > 0 ? `${selectedProduct.available} units ready for dispatch` : 'Out of Stock'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="muted-text">Standard Fulfillment:</span>
                  <span>1–3 business days</span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="button button--secondary"
                onClick={() => setSelectedProduct(null)}
              >
                Close
              </button>
              {Number(selectedProduct.available) > 0 && (
                <button
                  type="button"
                  className="button button--primary"
                  onClick={() => {
                    handleAdd(selectedProduct)
                    setSelectedProduct(null)
                  }}
                >
                  <Icon name="cart" size={16} /> Add to Cart
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CustomerShopView
