import { ROLE_DETAILS } from '../roles.js'

function DevelopmentRolePreview({ role, onChange }) {
  return (
    <label className="role-preview">
      <span className="role-preview__label">DEVELOPMENT ROLE PREVIEW</span>
      <select
        aria-label="Development role preview"
        value={role}
        onChange={(event) => onChange(event.target.value)}
      >
        {Object.entries(ROLE_DETAILS).map(([roleId, details]) => (
          <option key={roleId} value={roleId}>{details.label}</option>
        ))}
      </select>
    </label>
  )
}

export default DevelopmentRolePreview
