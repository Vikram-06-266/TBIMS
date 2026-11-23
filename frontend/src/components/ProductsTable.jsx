import { useState, useEffect } from 'react'
import Icon from './Icon.jsx'
import { LOW_STOCK_THRESHOLD } from '../demo/demo-data.js'

const PAGE_SIZE = 50

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

function formatQuantity(value) {
  if (value === undefined || value === null || value === '') return '—'
  const quantity = Number(value)
  return Number.isInteger(quantity) && quantity >= 0
    ? new Intl.NumberFormat('en-IN').format(quantity)
    : '—'
}

function ProductsTable({
  products,
  loading,
  error,
  onAddProduct,
  onViewProduct,
  onEditProduct,
  canEdit = false,
  emptyTitle = 'No products found',
  emptyMessage = 'Try adjusting your filters or add a product to get started.',
}) {
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    setCurrentPage(1)
  }, [products?.length])

  if (loading) {
    return (
      <div className="table-state" role="status">
        <span className="spinner" />
        <strong>Loading products</strong>
        <span>Fetching the latest inventory data.</span>
      </div>
    )
  }

  if (error) {
    const requestId = error.requestId
    return (
      <div className="table-state table-state--error" role="alert">
        <span className="table-state__icon"><Icon name="alert" size={21} /></span>
        <strong>{error.status === 503 ? 'Product service unavailable' : 'Could not load products'}</strong>
        <span>{error.message}</span>
        {requestId && <small>Request ID: {requestId}</small>}
      </div>
    )
  }

  if (!products || products.length === 0) {
    return (
      <div className="table-state">
        <span className="table-state__icon"><Icon name="box" size={21} /></span>
        <strong>{emptyTitle}</strong>
        <span>{emptyMessage}</span>
        {onAddProduct && (
          <button className="button button--secondary" type="button" onClick={onAddProduct}>
            <Icon name="plus" size={16} />
            Add product
          </button>
        )}
      </div>
    )
  }

  const totalItems = products.length
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE))
  const safePage = Math.min(Math.max(1, currentPage), totalPages)
  const startIndex = (safePage - 1) * PAGE_SIZE
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalItems)
  const paginatedProducts = products.slice(startIndex, endIndex)

  return (
    <div>
      <div className="table-scroll">
        <table className="products-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th>Category</th>
              <th className="numeric">Unit price</th>
              <th className="numeric">On hand</th>
              <th className="numeric">Reserved</th>
              <th className="numeric">Available</th>
              <th style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedProducts.map((product, index) => {
              const isLowStock = Number(product.on_hand) <= LOW_STOCK_THRESHOLD
              const isOutOfStock = Number(product.available) <= 0

              return (
                <tr
                  key={product.id ?? product.sku ?? `${product.name}-${index}`}
                  className={isLowStock ? 'low-stock-row' : ''}
                >
                  <td>
                    <div className="product-name">
                      <span className="product-avatar">{product.name?.trim()?.[0]?.toUpperCase() || 'P'}</span>
                      <div>
                        <span>{product.name || 'Unnamed product'}</span>
                        {isLowStock && (
                          <div style={{ marginTop: '2px' }}>
                            <span className="low-stock-badge">
                              {isOutOfStock ? 'Out of stock' : 'Low stock'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td><span className="sku-label">{product.sku || '—'}</span></td>
                  <td><span className="category-label">{product.category || 'Uncategorized'}</span></td>
                  <td className="numeric">{formatCurrency(product.unit_price)}</td>
                  <td className="numeric">
                    <span className={isLowStock ? 'qty-negative' : ''}>
                      {formatQuantity(product.on_hand)}
                    </span>
                  </td>
                  <td className="numeric">{formatQuantity(product.reserved)}</td>
                  <td className="numeric">
                    <strong className={isOutOfStock ? 'qty-negative' : 'available-value'}>
                      {formatQuantity(product.available)}
                    </strong>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', gap: '6px' }}>
                      {onViewProduct && (
                        <button
                          type="button"
                          className="button button--secondary button--compact"
                          onClick={() => onViewProduct(product)}
                          title="View product details"
                          style={{ padding: '3px 8px', fontSize: '12px' }}
                        >
                          Details
                        </button>
                      )}
                      {canEdit && onEditProduct && (
                        <button
                          type="button"
                          className="button button--secondary button--compact"
                          onClick={() => onEditProduct(product)}
                          title="Edit product"
                          style={{ padding: '3px 8px', fontSize: '12px' }}
                        >
                          Edit
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

      {totalPages > 1 && (
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
            Showing <strong>{startIndex + 1}</strong>–<strong>{endIndex}</strong> of <strong>{totalItems.toLocaleString()}</strong> products
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              className="button button--secondary button--compact"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              style={{ opacity: safePage <= 1 ? 0.5 : 1 }}
            >
              Previous
            </button>
            <span>
              Page <strong>{safePage}</strong> of <strong>{totalPages}</strong>
            </span>
            <button
              type="button"
              className="button button--secondary button--compact"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              style={{ opacity: safePage >= totalPages ? 0.5 : 1 }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProductsTable
