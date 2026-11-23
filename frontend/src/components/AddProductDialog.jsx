import { useState } from 'react'
import Icon from './Icon.jsx'

const INITIAL_VALUES = { sku: '', name: '', category: '', unit_price: '' }
const PRICE_PATTERN = /^\d+(?:\.\d+)?$/

function validate(values) {
  const errors = {}
  if (!values.sku.trim()) errors.sku = 'Enter a SKU.'
  if (!values.name.trim()) errors.name = 'Enter a product name.'
  if (
    !PRICE_PATTERN.test(values.unit_price.trim()) ||
    !Number.isFinite(Number(values.unit_price))
  ) {
    errors.unit_price = 'Enter a non-negative decimal price.'
  }
  return errors
}

function AddProductDialog({
  saving,
  error,
  supportsCategory,
  onClose,
  onSubmit,
}) {
  const [values, setValues] = useState(INITIAL_VALUES)
  const [errors, setErrors] = useState({})

  function updateField(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: undefined }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    const validationErrors = validate(values)
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) return

    const product = {
      sku: values.sku.trim(),
      name: values.name.trim(),
      unit_price: values.unit_price.trim(),
    }
    if (values.category.trim()) product.category = values.category.trim()
    onSubmit(product)
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !saving) onClose()
    }}>
      <section
        aria-labelledby="add-product-title"
        aria-modal="true"
        className="product-dialog"
        role="dialog"
      >
        <div className="product-dialog__header">
          <div>
            <span className="dialog-icon"><Icon name="box" size={20} /></span>
            <h2 id="add-product-title">Add a product</h2>
            <p>Enter the product details to add it to your catalogue.</p>
          </div>
          <button
            aria-label="Close dialog"
            className="icon-button"
            disabled={saving}
            onClick={onClose}
            type="button"
          >
            <Icon name="close" size={19} />
          </button>
        </div>

        {error && <div className="form-api-error" role="alert">{error}</div>}

        <form className="product-form" onSubmit={handleSubmit} noValidate>
          <label className="form-field">
            <span>SKU <span className="required">*</span></span>
            <input
              autoFocus
              aria-invalid={Boolean(errors.sku)}
              aria-describedby={errors.sku ? 'sku-error' : undefined}
              name="sku"
              onChange={updateField}
              placeholder="e.g. ELC-1042"
              value={values.sku}
            />
            {errors.sku && <small id="sku-error" className="field-error">{errors.sku}</small>}
          </label>
          <label className="form-field">
            <span>Product name <span className="required">*</span></span>
            <input
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'name-error' : undefined}
              name="name"
              onChange={updateField}
              placeholder="e.g. Wireless Keyboard"
              value={values.name}
            />
            {errors.name && <small id="name-error" className="field-error">{errors.name}</small>}
          </label>
          {supportsCategory && (
            <label className="form-field">
              <span>Category <span className="optional">(optional)</span></span>
              <input
                name="category"
                onChange={updateField}
                placeholder="e.g. Electronics"
                value={values.category}
              />
            </label>
          )}
          <label className="form-field">
            <span>Unit price <span className="required">*</span></span>
            <div className="price-input">
              <span>₹</span>
              <input
                aria-invalid={Boolean(errors.unit_price)}
                aria-describedby={errors.unit_price ? 'price-error' : undefined}
                inputMode="decimal"
                name="unit_price"
                onChange={updateField}
                placeholder="0.00"
                value={values.unit_price}
              />
            </div>
            {errors.unit_price && <small id="price-error" className="field-error">{errors.unit_price}</small>}
          </label>

          <p className="form-note">
            Stock quantities are managed separately by the inventory system.
          </p>

          <div className="product-form__actions">
            <button className="button button--secondary" disabled={saving} onClick={onClose} type="button">
              Cancel
            </button>
            <button className="button button--primary" disabled={saving} type="submit">
              {saving ? <><span className="button-spinner" /> Saving…</> : <><Icon name="plus" size={16} /> Add product</>}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default AddProductDialog
