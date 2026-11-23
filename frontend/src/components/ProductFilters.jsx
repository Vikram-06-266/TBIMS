import Icon from './Icon.jsx'

function ProductFilters({ filters, categories, onChange }) {
  return (
    <div className="filters" aria-label="Product filters">
      <label className="filter-field filter-field--search">
        <span className="sr-only">Search by SKU</span>
        <Icon name="search" size={17} />
        <input
          type="search"
          value={filters.sku || ''}
          onChange={(event) => onChange('sku', event.target.value)}
          placeholder="Search SKU"
        />
      </label>
      <label className="filter-field filter-field--search filter-field--name">
        <span className="sr-only">Search by product name</span>
        <Icon name="search" size={17} />
        <input
          type="search"
          value={filters.name || ''}
          onChange={(event) => onChange('name', event.target.value)}
          placeholder="Search product name"
        />
      </label>
      <label className="filter-field filter-field--category">
        <span className="sr-only">Filter by category</span>
        <select
          value={filters.category || ''}
          onChange={(event) => onChange('category', event.target.value)}
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
      </label>
      <label className="filter-field filter-field--category">
        <span className="sr-only">Filter by stock status</span>
        <select
          value={filters.stockStatus || ''}
          onChange={(event) => onChange('stockStatus', event.target.value)}
        >
          <option value="">All stock levels</option>
          <option value="in">In Stock (Available &gt; 0)</option>
          <option value="low">Low Stock (On-hand &le; 10)</option>
          <option value="out">Out of Stock (Available = 0)</option>
        </select>
      </label>
    </div>
  )
}

export default ProductFilters
