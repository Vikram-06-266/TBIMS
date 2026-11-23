import Icon from './Icon.jsx'
import DevelopmentRolePreview from './DevelopmentRolePreview.jsx'
import { ROLE_DETAILS } from '../roles.js'

function TopBar({
  apiState,
  role,
  user,
  isLiveMode,
  dbInfo,
  dbError,
  onToggleMode,
  onRoleChange,
  onResetDemoData,
  onLogout,
}) {
  return (
    <header className="topbar">
      <div className="topbar__context">
        {isLiveMode ? (
          <>
            <span className={`connection-dot connection-dot--${dbInfo?.ok ? 'connected' : 'unavailable'}`} />
            <span>
              {dbInfo?.ok ? `Neon Connected (${dbInfo.database})` : 'PostgreSQL Disconnected'}
            </span>
            <span className={`badge ${dbInfo?.ok ? 'badge--green' : 'badge--neutral'}`} style={{ marginLeft: 6 }}>
              Live Mode
            </span>
          </>
        ) : (
          <>
            <span className="connection-dot connection-dot--demo" />
            <span>Demo Mode (In-Memory)</span>
            <span className="demo-pill-tag">Sample State</span>
          </>
        )}
      </div>

      <div className="topbar__actions">
        {/* Mode Switcher Toggle */}
        <button
          type="button"
          className={`button button--compact ${isLiveMode ? 'button--primary' : 'button--secondary'}`}
          onClick={onToggleMode}
          title={isLiveMode ? "Switch to In-Memory Demonstration Mode" : "Switch to Live Neon PostgreSQL Database"}
          style={{ fontSize: '11px', fontWeight: 650 }}
        >
          <Icon name="database" size={14} />
          <span>{isLiveMode ? 'Mode: Live DB' : 'Mode: Demo'}</span>
        </button>

        {/* Role Switcher: Strictly limited to Demonstration Mode only */}
        {!isLiveMode && onRoleChange && (
          <DevelopmentRolePreview role={role} onChange={onRoleChange} />
        )}

        {/* Reset Demo Data Button (Only in demo mode) */}
        {!isLiveMode && onResetDemoData && (
          <button
            type="button"
            className="button button--secondary button--compact reset-data-btn"
            onClick={onResetDemoData}
            title="Reset all demo products, orders, and movements to initial state"
          >
            <Icon name="history" size={14} />
            <span>Reset Demo</span>
          </button>
        )}

        {/* User Identity Display */}
        <div
          className="profile-placeholder"
          aria-label={!isLiveMode ? 'Demo role preview' : 'Signed-in user'}
        >
          <span className="profile-placeholder__avatar"><Icon name="user" size={17} /></span>
          <span className="profile-placeholder__copy">
            <strong>{user?.username || role}</strong>
            <small>
              {ROLE_DETAILS[role]?.label || role}
              {!isLiveMode ? ' · demo' : ' · live'}
            </small>
          </span>
        </div>

        {/* Sign out */}
        <button
          className="logout-placeholder"
          onClick={onLogout}
          type="button"
          title="Sign out of current session"
        >
          <Icon name="logout" size={16} />
          <span>Sign out</span>
        </button>
      </div>
    </header>
  )
}

export default TopBar
