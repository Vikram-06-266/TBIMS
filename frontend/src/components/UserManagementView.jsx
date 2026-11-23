import Icon from './Icon.jsx'
import { DEMO_USERS } from '../demo/demo-data.js'
import { ROLE_DETAILS } from '../roles.js'

function UserManagementView({ currentRole = 'admin' }) {
  const permissionsMatrix = [
    { permission: 'View Dashboard & Stock Figures', owner: true, admin: true, inventoryManager: true, staff: true, customer: true },
    { permission: 'Search & Filter Catalogue', owner: true, admin: true, inventoryManager: true, staff: true, customer: true },
    { permission: 'Add New Products to Catalogue', owner: true, admin: true, inventoryManager: true, staff: false, customer: false },
    { permission: 'Edit Existing Product Details', owner: true, admin: true, inventoryManager: true, staff: false, customer: false },
    { permission: 'Receive Stock Intake', owner: true, admin: true, inventoryManager: true, staff: false, customer: false },
    { permission: 'Create Orders & Reserve Stock', owner: true, admin: true, inventoryManager: true, staff: true, customer: false },
    { permission: 'Confirm & Fulfill Orders', owner: true, admin: true, inventoryManager: true, staff: true, customer: false },
    { permission: 'Cancel Order & Release Stock', owner: true, admin: true, inventoryManager: true, staff: true, customer: false },
    { permission: 'Process Customer Returns', owner: true, admin: true, inventoryManager: true, staff: false, customer: false },
    { permission: 'View System Audit Trail', owner: true, admin: true, inventoryManager: false, staff: false, customer: false },
    { permission: 'Access Analytics & Reports', owner: true, admin: true, inventoryManager: true, staff: false, customer: false },
    { permission: 'Configure Server Authentication', owner: true, admin: true, inventoryManager: false, staff: false, customer: false },
  ]

  return (
    <div className="user-management-view">
      <div className="demo-banner demo-banner--isolated" role="status">
        <Icon name="users" size={18} />
        <div>
          <strong>TBIMS USER &amp; ROLE ADMINISTRATION — ARCHITECTURE SPECIFICATION</strong>
          <span className="demo-banner__detail">
            Accounts are authenticated via backend JWT issuance with cryptographic role claims.
            The 5 roles below reflect the verified system specification.
          </span>
        </div>
      </div>

      {/* Configured Accounts Table */}
      <section className="dashboard-card">
        <div className="card-header">
          <div>
            <h2>Configured System Accounts</h2>
            <p>Pre-configured accounts matching the backend auth engine and seed scripts.</p>
          </div>
          <span className="badge badge--neutral">5 accounts</span>
        </div>

        <div className="table-scroll">
          <table className="products-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Display Name</th>
                <th>Role ID</th>
                <th>Description</th>
                <th>Auth Boundary</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_USERS.map((u) => {
                const isCurrent = u.role === currentRole
                return (
                  <tr key={u.username} className={isCurrent ? 'order-pending-row' : ''}>
                    <td>
                      <span className="sku-label" style={{ fontWeight: 700 }}>{u.username}</span>
                      {isCurrent && <span className="low-stock-badge" style={{ marginLeft: '6px' }}>Active</span>}
                    </td>
                    <td><strong>{u.display}</strong></td>
                    <td>
                      <span className="category-label">{u.role}</span>
                    </td>
                    <td>{u.description}</td>
                    <td>
                      <small className="muted-text">Managed by server environment / seed</small>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Role-Based Access Control (RBAC) Permissions Matrix */}
      <section className="dashboard-card" style={{ marginTop: '20px' }}>
        <div className="card-header">
          <div>
            <h2>Role-Based Access Control (RBAC) Matrix</h2>
            <p>Enforced across client navigation routes and backend Express middleware.</p>
          </div>
          <span className="badge badge--violet">RBAC Policy</span>
        </div>

        <div className="table-scroll">
          <table className="products-table compact-table">
            <thead>
              <tr>
                <th>Operation / Permission</th>
                <th style={{ textAlign: 'center' }}>Owner</th>
                <th style={{ textAlign: 'center' }}>Admin</th>
                <th style={{ textAlign: 'center' }}>Inventory Manager</th>
                <th style={{ textAlign: 'center' }}>Staff</th>
                <th style={{ textAlign: 'center' }}>Customer</th>
              </tr>
            </thead>
            <tbody>
              {permissionsMatrix.map((row, idx) => (
                <tr key={idx}>
                  <td><strong>{row.permission}</strong></td>
                  <td style={{ textAlign: 'center' }}>
                    {row.owner ? <span className="check-mark">✓</span> : <span className="cross-mark">—</span>}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {row.admin ? <span className="check-mark">✓</span> : <span className="cross-mark">—</span>}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {row.inventoryManager ? <span className="check-mark">✓</span> : <span className="cross-mark">—</span>}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {row.staff ? <span className="check-mark">✓</span> : <span className="cross-mark">—</span>}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {row.customer ? <span className="check-mark">✓</span> : <span className="cross-mark">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export default UserManagementView
