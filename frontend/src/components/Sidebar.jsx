import Icon from './Icon.jsx'
import { ROLE_DETAILS, ROLE_NAVIGATION } from '../roles.js'

function Sidebar({ activePage, apiState, isDemoMode, role, onNavigate }) {
  const roleDetails = ROLE_DETAILS[role]
  const navigation = ROLE_NAVIGATION[role]
  const dataSourceMessage = isDemoMode
    ? 'Demo values stay in this browser session.'
    : apiState === 'connected'
      ? 'Product values are supplied by the backend API.'
      : 'Live product values appear when the API is connected.'

  return (
    <aside className="sidebar">
      <a className="brand" href="#dashboard" onClick={(event) => {
        event.preventDefault()
        onNavigate('dashboard')
      }}>
        <span className="brand__mark"><Icon name="box" size={23} /></span>
        <span className="brand__text">
          <strong>stockroom</strong>
          <small>RETAIL OPERATIONS</small>
        </span>
      </a>

      <div className="sidebar__section-label">{roleDetails.label} WORKSPACE</div>
      <nav className="sidebar-nav" aria-label={`${roleDetails.label} navigation`}>
        {navigation.map((item) => (
          <button
            aria-current={activePage === item.id ? 'page' : undefined}
            className={`nav-item${activePage === item.id ? ' nav-item--active' : ''}`}
            key={item.id}
            onClick={() => onNavigate(item.id)}
            type="button"
          >
            <Icon name={item.icon} size={19} />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="sidebar__bottom">
        <div className="sidebar-note">
          <span className="sidebar-note__icon"><Icon name="database" size={17} /></span>
          <div>
            <strong>{isDemoMode ? 'Isolated demo data' : 'Inventory data source'}</strong>
            <p>{dataSourceMessage}</p>
          </div>
        </div>
        <div className="sidebar__version">TBIMS <span>·</span> WT + SE</div>
      </div>
    </aside>
  )
}

export default Sidebar
